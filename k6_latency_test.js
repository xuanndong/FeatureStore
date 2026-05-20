/**
 * ============================================================
 *  AetherFS — Kiểm thử độ trễ Online Store (Redis Stack)
 *  Công cụ: Grafana k6 v2.x
 * ============================================================
 *
 *  Mục tiêu kiểm thử:
 *    - Đo độ trễ truy xuất vector đặc trưng từ Redis Stack
 *      thông qua các API của Photon service (FastAPI).
 *    - Chứng minh hệ thống đạt >= 500 req/s với error rate = 0%
 *    - Đảm bảo p(95) < 20ms (ngưỡng SLA cho real-time serving)
 *
 *  Định dạng Redis key của AetherFS:
 *    fs:<feature_group_name>:<entity_key>:<entity_value>
 *    Ví dụ: fs:credit_card_fg:transaction_id:TXN_1779119409
 *
 *  Các API được kiểm thử:
 *    [1] GET  /online-store/status            — Ping / health check Redis
 *    [2] GET  /online-store/features/keys     — Discover key thực từ Redis
 *    [3] GET  /online-store/features/get      — Truy xuất JSON feature (JSON.GET)
 *    [4] POST /online-store/features/fetch    — Truy xuất hash feature (HGETALL)
 *
 *  Cách chạy:
 *    k6 run k6_latency_test.js
 *    k6 run --out json=results.json k6_latency_test.js - Xuất file json
 *    k6 run -e BASE_URL=http://localhost:3000 k6_latency_test.js - Đổi port
 *    k6 run --out web-dashboard k6_latency_test.js - Có dashboard http://localhost:5665
 *    k6 run --vus 5 --duration 20s k6_latency_test.js - Chạy smoke test
 * ============================================================
 */

import http from "k6/http";
import { check, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ─── Cấu hình môi trường ─────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const API_VERSION = __ENV.API_VERSION || "v1.0.0";

// ─── Cấu hình tải (Load Profile) ─────────────────────────────
export const options = {
  /**
   * Kịch bản tải theo giai đoạn (Ramping VUs):
   *   Giai đoạn 1 – Warm-up    : 0 → 20 VU trong 30s
   *   Giai đoạn 2 – Ramp-up    : 20 → 50 VU trong 30s
   *   Giai đoạn 3 – Steady     : Duy trì 50 VU trong 2 phút (pha đo chính)
   *   Giai đoạn 4 – Peak       : 50 → 100 VU trong 30s (kiểm tra chịu đỉnh)
   *   Giai đoạn 5 – Cool-down  : 100 → 0 VU trong 30s
   */
  stages: [
    { duration: "30s", target: 20 }, // Warm-up
    { duration: "30s", target: 50 }, // Ramp-up
    { duration: "2m", target: 50 }, // Steady-state (pha đo chính)
    { duration: "30s", target: 100 }, // Peak test
    { duration: "30s", target: 0 }, // Cool-down
  ],

  /**
   * Ngưỡng SLA — kịch bản FAIL nếu vi phạm bất kỳ ngưỡng nào.
   *
   * Mục tiêu từ luận văn (Bảng 3.5):
   *   avg   < 10ms   → thực tế: 7.2ms
   *   p(95) < 20ms   → thực tế: 15.6ms
   *   error rate = 0%
   *
   * Lưu ý: Ngưỡng đo trên HTTP round-trip (client → FastAPI → Redis → client).
   * Kết quả thực tế tốt hơn mục tiêu là bình thường với hệ thống local.
   */
  thresholds: {
    // ── Ngưỡng cứng (PHẢI ĐẠT) ──────────────────────────────
    "http_req_failed": ["rate==0"],    // Tỷ lệ lỗi HTTP = 0%

    // ── Ngưỡng hiệu năng (SLA) ──────────────────────────────
    "http_req_duration": [
      "avg<10",                        // Avg < 10ms   (mục tiêu: 7.2ms)
      "p(95)<20",                      // p95 < 20ms   (mục tiêu: 15.6ms) ← SLA chính
      "p(99)<50",                      // p99 < 50ms   (biên an toàn)
    ],

    // ── Ngưỡng riêng cho từng loại API ──────────────────────
    // Chỉ đo GET /features/get — đây là API truy xuất feature trực tiếp
    "latency_get_feature{api:get_feature}": ["p(95)<20"],
    // HGETALL có thêm overhead serialize → cho phép p95 rộng hơn chút
    "latency_fetch_feature{api:fetch_feature}": ["p(95)<25"],

    // ── Tỷ lệ correctness checks phải pass ──────────────────
    // (bao gồm cả HTTP status và cấu trúc response, không tính perf checks)
    "correctness_checks": ["rate>0.99"],
  },

  // Metadata xuất hiện trong báo cáo k6
  tags: {
    project: "AetherFS",
    component: "OnlineStore",
    target: "RedisStack",
  },
};

// ─── Custom Metrics ───────────────────────────────────────────
// Đo latency riêng cho từng loại API (có histogram percentiles)
const latencyStatus = new Trend("latency_status", true);
const latencyListKeys = new Trend("latency_list_keys", true);
const latencyGetFeature = new Trend("latency_get_feature", true);
const latencyFetchFeature = new Trend("latency_fetch_feature", true);

// Đếm key không tìm thấy (data = null) — không tính là lỗi HTTP
const keyNotFound = new Counter("key_not_found_total");

// Tỷ lệ đúng về mặt logic (correctness) — tách biệt khỏi threshold SLA
const correctnessChecks = new Rate("correctness_checks");

// ─── Setup — chạy 1 lần duy nhất trước khi bắt đầu test ─────
export function setup() {
  const headers = { "X-API-Version": API_VERSION };

  console.log("[Setup] Khởi động kiểm thử AetherFS Online Store...");
  console.log(`Base URL  : ${BASE_URL}`);
  console.log(`API Ver   : ${API_VERSION}`);
  console.log("━".repeat(60));

  // ── Bước 1: Kiểm tra kết nối Redis ──────────────────────────
  const statusRes = http.get(`${BASE_URL}/online-store/status`, {
    headers,
    tags: { api: "status", phase: "setup" },
  });

  if (statusRes.status !== 200) {
    throw new Error(
      `Không thể kết nối tới Photon service! HTTP ${statusRes.status}.\n` +
      `   Đảm bảo service đang chạy tại: ${BASE_URL}`
    );
  }

  const statusBody = safeParseJSON(statusRes.body);
  if (statusBody?.data?.status !== "Connected") {
    throw new Error(
      `Redis Stack chưa kết nối!\n` +
      `   Phản hồi: ${statusRes.body?.substring(0, 200)}`
    );
  }

  const pingMs = statusBody?.data?.latency_ms ?? "N/A";
  console.log(`Redis đang hoạt động — Ping (server-side): ${pingMs} ms`);

  // ── Bước 2: Discover key thực từ Redis (fs:*) ───────────────
  console.log("[Setup] Đang lấy danh sách key thực từ Redis (fs:*)...");

  const keysRes = http.get(`${BASE_URL}/online-store/features/keys`, {
    headers,
    tags: { api: "keys", phase: "setup" },
  });

  if (keysRes.status !== 200) {
    throw new Error(
      `Không thể lấy danh sách keys! HTTP ${keysRes.status}.\n` +
      `   Body: ${keysRes.body?.substring(0, 300)}`
    );
  }

  const keysBody = safeParseJSON(keysRes.body);
  const allKeys = keysBody?.data || [];

  if (allKeys.length === 0) {
    throw new Error(
      "Redis không có key nào với prefix 'fs:*'.\n" +
      "   Hãy chạy pipeline materialization trước khi kiểm thử."
    );
  }

  // Hiển thị các key tìm được
  console.log(`Tìm thấy ${allKeys.length} key(s) trong Redis:`);
  allKeys.forEach((k, i) => {
    if (i < 10) console.log(`   [${i + 1}] ${k}`);
  });
  if (allKeys.length > 10) {
    console.log(`   ... và ${allKeys.length - 10} key(s) khác`);
  }

  // ── Bước 3: Parse key → entity objects ──────────────────────
  // Định dạng: fs:<feature_group_name>:<entity_col>:<entity_value>
  // Ví dụ:     fs:credit_card_fg:transaction_id:TXN_1779119409
  //   → entity_name = "credit_card_fg"   (feature group name)
  //   → record_id   = "TXN_1779119409"   (entity value)
  const entities = parseEntitiesFromKeys(allKeys);

  console.log(`\nParse thành công ${entities.length} entity từ keys:`);
  entities.slice(0, 5).forEach(e =>
    console.log(`   • entity_name="${e.entity_name}"  record_id="${e.record_id}"`)
  );

  // ── Bước 4: Xác nhận một key mẫu trả về dữ liệu thực ───────
  console.log("\n[Setup] Kiểm tra nhanh dữ liệu thực từ Redis...");
  const sampleKey = allKeys[0];
  const sampleKeyUrl = `${BASE_URL}/online-store/features/get?key=${encodeURIComponent(sampleKey)}`;
  const sampleRes = http.get(sampleKeyUrl, { headers });
  const sampleBody = safeParseJSON(sampleRes.body);

  if (sampleBody?.data && typeof sampleBody.data === "object") {
    const fieldCount = Object.keys(sampleBody.data).length;
    console.log(`Key mẫu "${sampleKey}" trả về ${fieldCount} trường đặc trưng`);
    console.log(`   Ví dụ: ${JSON.stringify(sampleBody.data).substring(0, 120)}...`);
  } else {
    console.warn(`Key mẫu "${sampleKey}" không có dữ liệu hoặc đã hết hạn`);
  }

  console.log("\nCấu hình kiểm thử:");
  console.log(`   Keys (JSON.GET)   : ${allKeys.length}`);
  console.log(`   Entities (HGETALL): ${entities.length}`);
  console.log(`   SLA avg           : < 10ms  (mục tiêu: 7.2ms)`);
  console.log(`   SLA p(95)         : < 20ms  (mục tiêu: 15.6ms)`);
  console.log(`   Mục tiêu          : >= 500 req/s, error rate = 0%`);
  console.log("━".repeat(60));

  return { keys: allKeys, entities: entities };
}

// ─── Main VU Function — chạy liên tục cho mỗi Virtual User ───
export default function (data) {
  const keys = data.keys || [];
  const entities = data.entities || [];

  const headers = {
    "Content-Type": "application/json",
    "X-API-Version": API_VERSION,
  };

  // ── Nhóm 1: Health Check Redis ────────────────────────────
  group("01_redis_health_check", function () {
    const res = http.get(`${BASE_URL}/online-store/status`, {
      headers,
      tags: { api: "status" },
    });
    const body = safeParseJSON(res.body);

    // Correctness checks (phải luôn đúng)
    const ok = check(res, {
      "[Status] HTTP 200": (r) => r.status === 200,
      "[Status] Redis connected": (r) => safeParseJSON(r.body)?.data?.status === "Connected",
    });
    correctnessChecks.add(ok);

    latencyStatus.add(res.timings.duration, { api: "status" });
    logHttpError(res, "status");
  });

  // ── Nhóm 2: Liệt kê Keys (đo overhead scan Redis) ────────
  group("02_list_feature_keys", function () {
    const res = http.get(`${BASE_URL}/online-store/features/keys`, {
      headers,
      tags: { api: "list_keys" },
    });
    const body = safeParseJSON(res.body);

    const ok = check(res, {
      "[Keys] HTTP 200": (r) => r.status === 200,
      "[Keys] Trả về mảng": (r) => Array.isArray(safeParseJSON(r.body)?.data),
      "[Keys] Có dữ liệu": (r) => (safeParseJSON(r.body)?.data || []).length > 0,
    });
    correctnessChecks.add(ok);

    latencyListKeys.add(res.timings.duration, { api: "list_keys" });
    logHttpError(res, "list_keys");
  });

  // ── Nhóm 3: Truy xuất JSON Feature bằng key thực (JSON.GET) ─
  // Đây là API trọng tâm — tương đương redis_client.json().get(key) trong Python
  group("03_get_feature_by_key", function () {
    if (keys.length === 0) return;

    // Chọn ngẫu nhiên 1 key thực từ danh sách đã discover
    const key = keys[Math.floor(Math.random() * keys.length)];
    const url = `${BASE_URL}/online-store/features/get?key=${encodeURIComponent(key)}`;
    const res = http.get(url, { headers, tags: { api: "get_feature" } });
    const body = safeParseJSON(res.body);

    // Ghi nhận key không tìm thấy (không phải lỗi — key có thể expired)
    if (body !== null && body.data === null) {
      keyNotFound.add(1, { api: "get_feature" });
    }

    // Correctness: HTTP 200 và response có cấu trúc đúng
    const ok = check(res, {
      "[GetFeature] HTTP 200": (r) => r.status === 200,
      "[GetFeature] Body hợp lệ": (r) => safeParseJSON(r.body) !== null,
      "[GetFeature] Có trường 'data'": (r) => "data" in (safeParseJSON(r.body) ?? {}),
      // data = null (không tìm thấy) hoặc object (có dữ liệu) đều hợp lệ
      "[GetFeature] data đúng kiểu": (r) => {
        const b = safeParseJSON(r.body);
        return b !== null && (b.data === null || typeof b.data === "object");
      },
    });
    correctnessChecks.add(ok);

    latencyGetFeature.add(res.timings.duration, { api: "get_feature" });
    logHttpError(res, "get_feature");
  });

  // ── Nhóm 4: Truy xuất Hash Feature theo Entity (HGETALL) ──
  group("04_fetch_feature_by_entity", function () {
    if (entities.length === 0) return;

    // Chọn ngẫu nhiên 1 entity thực đã parse từ Redis key
    const entity = entities[Math.floor(Math.random() * entities.length)];
    const payload = JSON.stringify({
      entity_name: entity.entity_name,
      record_id: entity.record_id,
    });

    const res = http.post(
      `${BASE_URL}/online-store/features/fetch`,
      payload,
      { headers, tags: { api: "fetch_feature" } }
    );
    const body = safeParseJSON(res.body);

    if (body?.data?.features === null) {
      keyNotFound.add(1, { api: "fetch_feature" });
    }

    const ok = check(res, {
      "[FetchFeature] HTTP 200": (r) => r.status === 200,
      "[FetchFeature] Body hợp lệ": (r) => "data" in (safeParseJSON(r.body) ?? {}),
    });
    correctnessChecks.add(ok);

    latencyFetchFeature.add(res.timings.duration, { api: "fetch_feature" });
    logHttpError(res, "fetch_feature");
  });
}

// ─── Teardown — chạy 1 lần sau khi test kết thúc ─────────────
export function teardown(data) {
  console.log("\n" + "═".repeat(60));
  console.log("[Teardown] Kiểm thử hoàn tất!");
  console.log(`   Keys đã kiểm thử  : ${(data.keys || []).length}`);
  console.log(`   Entities đã dùng  : ${(data.entities || []).length}`);
  console.log("═".repeat(60));
  console.log("Xuất kết quả chi tiết:");
  console.log("   k6 run --out json=results.json k6_latency_test.js");
  console.log("   k6 run --out csv=results.csv   k6_latency_test.js");
  console.log("═".repeat(60));
}

// ─── Hàm tiện ích ────────────────────────────────────────────

/**
 * Parse JSON an toàn — trả về null nếu lỗi cú pháp
 */
function safeParseJSON(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/**
 * Chỉ log khi có lỗi HTTP thực sự (status >= 400 hoặc network error)
 * Không log các "lỗi nghiệp vụ" như data = null
 */
function logHttpError(res, apiName) {
  if (res.status >= 400 || res.status === 0) {
    console.error(
      `[${apiName}] HTTP ${res.status} — ${res.body?.substring(0, 200)}`
    );
  }
}

/**
 * Parse danh sách Redis key thực thành entity objects.
 *
 * Định dạng key AetherFS:
 *   fs:<feature_group_name>:<entity_col>:<entity_value>
 *   ─────────────────────────────────────────────────────
 *   "fs:credit_card_fg:transaction_id:TXN_1779119409"
 *     → entity_name = "credit_card_fg"       (dùng cho HGETALL lookup)
 *     → record_id   = "TXN_1779119409"
 *
 *   "fs:feature_group_california_v3:block_id:446ffbb37f98"
 *     → entity_name = "feature_group_california_v3"
 *     → record_id   = "446ffbb37f98"
 *
 * Kết quả được deduplicate để tránh request trùng lặp.
 */
function parseEntitiesFromKeys(keys) {
  const seen = new Set();
  const result = [];

  for (const key of keys) {
    if (!key.startsWith("fs:")) continue;

    // Tách theo ":" — parts[1] = fg_name, parts[2] = col, parts[3+] = value
    const parts = key.split(":");
    if (parts.length < 4) {
      console.warn(`[Setup] Key không đúng định dạng (bỏ qua): "${key}"`);
      continue;
    }

    const entityName = parts[1];                  // feature group name
    const recordId = parts.slice(3).join(":"); // entity value (có thể chứa ":")

    const dedupKey = `${entityName}::${recordId}`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      result.push({ entity_name: entityName, record_id: recordId });
    }
  }

  if (result.length === 0) {
    const samples = keys.slice(0, 3).join(", ");
    console.warn(
      `[Setup] Không parse được entity nào.\n` +
      `   Key mẫu: ${samples}\n` +
      `   Mong đợi định dạng: fs:<fg_name>:<entity_col>:<entity_val>`
    );
  }

  return result;
}
