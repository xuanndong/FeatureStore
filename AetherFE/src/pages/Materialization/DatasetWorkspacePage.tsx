import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Terminal, Copy, Play, Loader2, Database, Table2,
  Layers, Share2, ShieldCheck, Image as ImageIcon,
  CheckCircle2, AlertCircle, Cpu, Clock, Package
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { datasetsApi } from '@/services/datasets';
import { viewsApi } from '@/services/views';
import { studioApi } from '@/services/studio';
import type { ScriptExecutionData, DatasetAccessInfoData } from '@/types';

export const DatasetWorkspacePage: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams] = useSearchParams();
  const datasetType = searchParams.get('type') || 'GROUP';
  const mode = searchParams.get('mode') || 'OFFLINE';
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'api' | 'workspace'>('workspace');

  // State Context
  const [features, setFeatures] = useState<any[]>([]);
  const [datasetName, setDatasetName] = useState<string>('Đang tải...');
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [endpointURL, setEndpointURL] = useState<string>("http://localhost:9000");
  const [contextLoading, setContextLoading] = useState(false);

  // State API Tab
  const [accessInfo, setAccessInfo] = useState<DatasetAccessInfoData | null>(null);
  const [loadingApi, setLoadingApi] = useState(false);

  // Init Editor & Execution State
  const [code, setCode] = useState("");
  // Requirements
  const [requirements, setRequirements] = useState("");

  const [isRunning, setIsRunning] = useState(false);
  const [execResult, setExecResult] = useState<ScriptExecutionData | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  useEffect(() => {
    const updatedCode = `# ---------------------------------------------------------
# AETHER WORKSPACE - DATA SCIENCE PLATFORM
# ---------------------------------------------------------
import s3fs
import pyarrow.dataset as ds
import pandas as pd
import matplotlib.pyplot as plt

def main():
    # 1. Khởi tạo FileSystem (Hệ thống tự động xác thực)
    fs = s3fs.S3FileSystem(client_kwargs={"endpoint_url": "${endpointURL}"})
    
    # 2. Tìm và nạp dữ liệu từ DATASET_PATH (biến đã được hệ thống tiêm vào)
    base_path = DATASET_PATH.replace("s3://", "").rstrip("/") + "/"
    files = fs.glob(base_path + "**/*.parquet")
    
    if not files:
        print("Loi: Khong tim thay du lieu Parquet hop le!")
        return
        
    df = ds.dataset(files, format="parquet", filesystem=fs).to_table().to_pandas()
    print(f"Dataset loaded successfully: {len(df)} rows")
    
    # VIẾT CODE CỦA BẠN TẠI ĐÂY
    # aether_log.log_scalar("Rows", len(df))

if __name__ == "__main__":
    main()
`;
    if (!code || code.includes("http://localhost:9000")) {
      setCode(updatedCode);
    }
  }, [endpointURL]);

  useEffect(() => {
    if (!datasetId) return;
    setContextLoading(true);
    const loadData = async () => {
      try {
        if (datasetType === 'VIEW') {
          const res = await viewsApi.getFeatureViewDetail(datasetId);
          if (res.data) {
            setDatasetName(res.data.name);
            if (res.data.created_at) setCreatedAt(res.data.created_at);
            if (res.data.features) setFeatures(res.data.features as any);
            if (res.data.endpoint_url) setEndpointURL(res.data.endpoint_url);
          }
        } else {
          const gRes = await studioApi.getFeatureGroup(datasetId);
          if (gRes.data) {
            const group = gRes.data;
            setDatasetName(group.name);
            if (group.created_at) setCreatedAt(group.created_at);
            if (group.features) setFeatures(group.features as any);
            if (group.endpoint_url) setEndpointURL(group.endpoint_url);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setContextLoading(false);
      }
    };
    loadData();
  }, [datasetId, datasetType]);

  const handleGenerateUrl = async () => {
    if (!datasetId) return;
    setLoadingApi(true);
    try {
      const res = await datasetsApi.getAccessInfo(datasetId, datasetType as any);
      setAccessInfo(res.data);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoadingApi(false);
    }
  };

  const handleRunCode = async () => {
    if (!datasetId) return;
    setIsRunning(true);
    setExecResult(null);
    setExecError(null);

    const reqArray = requirements.split(',').map(r => r.trim()).filter(Boolean);

    try {
      const response = await datasetsApi.runExperiment({
        dataset_id: datasetId,
        dataset_type: datasetType as any,
        code,
        requirements: reqArray
      });
      setExecResult(response.data);
    } catch (error: any) {
      setExecError(error.response?.data?.detail || error.message || "Lỗi thực thi.");
    } finally {
      setIsRunning(false);
    }
  };

  const generatePythonSnippet = () => {
    if (!accessInfo) return '';
    return `import s3fs
import pyarrow.dataset as ds
import pandas as pd

fs = s3fs.S3FileSystem(
    key="${accessInfo.access_key}",
    secret="${accessInfo.secret_key}",
    token="${accessInfo.session_token}",
    client_kwargs={"endpoint_url": "${endpointURL}"}
)

BASE_URI = "${accessInfo.dataset_uri}"
search_pattern = BASE_URI.replace("s3://", "").rstrip("/") + "/**/*.parquet"
parquet_files = fs.glob(search_pattern)

    if (!parquet_files):
        print("Không tìm thấy dữ liệu.")
    else:
        dataset = ds.dataset(parquet_files, format="parquet", filesystem=fs)
        df = dataset.to_table().to_pandas()
        print(f"Tong so dong: {len(df)}")
        print(df.head())`;
  };

  const generateOnlinePythonSnippet = () => {
    const cleanFgName = datasetName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const sampleKey = features.length > 0 && features[0].is_primary ? features[0].name : 'entity_key';

    return `import redis
import json

# 1. Khởi tạo kết nối đến Redis Stack (Online Store)
redis_client = redis.Redis(
    host='localhost', 
    port=6379, 
    decode_responses=True
)

# 2. Thông tin tra cứu (Thay đổi giá trị tương ứng)
feature_group = "${cleanFgName}"
entity_key_name = "${sampleKey}"
entity_value = "your_entity_id"  # ĐIỀN ID THỰC TẾ CỦA BẠN VÀO ĐÂY

# 3. Tạo Redis Key theo đúng chuẩn AetherFS
redis_key = f"fs:{feature_group}:{entity_key_name}:{entity_value}"

# 4. Lấy dữ liệu Real-time (Low-Latency Point Lookup)
raw_data = redis_client.json().get(redis_key)

if raw_data:
    print(f"Đã lấy được Online Features cho {entity_value}:")
    print(json.dumps(raw_data, indent=2))
else:
    print(f"Không tìm thấy dữ liệu cho khóa {redis_key}")
`;
  };

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', paddingBottom: '40px' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: '24px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, padding: 0 }}>
        &larr; Quay lại Market
      </button>

      {/* METADATA HEADER */}
      <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', border: '1px solid var(--border-color)', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: 'var(--text-main)' }}>Workspace: {datasetName}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', color: 'var(--primary)' }}><Database size={20} /></div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>LOẠI DỮ LIỆU</p>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>{datasetType === 'GROUP' ? 'Feature Group' : 'Feature View'}</p>
            </div>
          </div>
          <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', color: '#10b981' }}><Layers size={20} /></div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>NGÀY TẠO</p>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>{createdAt ? new Date(createdAt * 1000).toLocaleDateString('vi-VN') : 'Đang tải...'}</p>
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Table2 size={18} color="var(--text-secondary)" /> Danh sách Features ({features.length})
          </h3>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', maxHeight: '180px', overflowY: 'auto' }}>
            {contextLoading ? <p style={{ color: 'var(--text-secondary)' }}>Đang tải features...</p> : features.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Không có feature nào.</p> : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {features.map(f => (
                  <span key={f.id} style={{ background: '#fff', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {f.name} <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 400 }}>{f.data_type}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
        {mode === 'OFFLINE' ? (
          <>
            <button onClick={() => setActiveTab('api')} style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600, fontSize: '15px', borderBottom: activeTab === 'api' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'api' ? 'var(--primary)' : 'var(--text-secondary)' }}>
              <Share2 size={18} /> Get Pre-signed URL
            </button>
            <button onClick={() => setActiveTab('workspace')} style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600, fontSize: '15px', borderBottom: activeTab === 'workspace' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'workspace' ? 'var(--primary)' : 'var(--text-secondary)' }}>
              <Terminal size={18} /> Train In-system
            </button>
          </>
        ) : (
          <button style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600, fontSize: '15px', borderBottom: '2px solid var(--primary)', color: 'var(--primary)' }}>
            <Database size={18} /> Redis Connection Snippet
          </button>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        {activeTab === 'api' ? (
          <div style={{ padding: '32px' }}>
            {/* S3FS Warning */}
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '14px 16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertCircle size={20} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#b45309', fontWeight: 600 }}>Yêu cầu thư viện bắt buộc</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#92400e', lineHeight: 1.5 }}>
                  Để đọc dữ liệu từ Feature Store thông qua S3/MinIO, môi trường Python của bạn bắt buộc phải cài đặt <strong>s3fs</strong>. Vui lòng chạy lệnh <code>pip install s3fs pyarrow pandas</code> trước khi thực thi đoạn mã bên dưới.
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <button
                onClick={handleGenerateUrl}
                disabled={loadingApi}
                style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: loadingApi ? 'not-allowed' : 'pointer', fontSize: '14px' }}
              >
                {loadingApi ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="#fff" />} Generate Pre-signed URL
              </button>
            </div>

            {accessInfo && (
              <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                  <h4 style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', fontSize: '15px' }}>
                    <CheckCircle2 size={18} /> Thành công! Thông tin xác thực đã được tạo.
                  </h4>
                  <p style={{ margin: 0, fontSize: '14px', color: '#047857' }}>Hết hạn vào lúc: <strong>{new Date(accessInfo.expires_at * 1000).toLocaleString('vi-VN')}</strong></p>
                </div>

                <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '14px 16px', borderRadius: '12px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <ShieldCheck size={20} color="#2563eb" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#1d4ed8', fontWeight: 600 }}>Chính sách bảo mật giới hạn không gian</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#1e40af', lineHeight: 1.5 }}>
                      Thông tin xác thực (Key) được cấp phát là loại dùng một lần và bị giới hạn quyền. Bạn chỉ có quyền truy cập duy nhất bộ dữ liệu <strong>{datasetName}</strong>.
                    </p>
                  </div>
                </div>

                <div style={{ position: 'relative', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', height: '400px' }}>
                  <button
                    onClick={() => navigator.clipboard.writeText(generatePythonSnippet())}
                    style={{ position: 'absolute', zIndex: 10, top: '16px', right: '16px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500 }}
                  >
                    <Copy size={16} /> Copy Code
                  </button>
                  <Editor
                    height="100%"
                    defaultLanguage="python"
                    theme="vs-dark"
                    value={generatePythonSnippet()}
                    options={{ minimap: { enabled: false }, readOnly: true, fontSize: 14, padding: { top: 20, bottom: 20 }, fontLigatures: true }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : mode === 'ONLINE' ? (
          <div style={{ padding: '32px' }}>
            <div style={{ position: 'relative', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', height: '500px' }}>
              <button
                onClick={() => navigator.clipboard.writeText(generateOnlinePythonSnippet())}
                style={{ position: 'absolute', zIndex: 10, top: '16px', right: '16px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500 }}
              >
                <Copy size={16} /> Copy Code
              </button>
              <Editor
                height="100%"
                defaultLanguage="python"
                theme="vs-dark"
                value={generateOnlinePythonSnippet()}
                options={{ minimap: { enabled: false }, readOnly: true, fontSize: 14, padding: { top: 20, bottom: 20 }, fontLigatures: true }}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'auto', minHeight: '700px' }}>
            {/* WORKSPACE HEADER */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Terminal size={16} />
                  <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>Monaco Workspace</span>
                </div>

                {/* INPUT REQUIREMENTS */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={16} color="var(--text-secondary)" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Pip Packages:</span>
                  <input
                    type="text"
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    placeholder="pandas, scikit-learn, xgboost==1.7.0"
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px', width: '320px', outline: 'none' }}
                  />
                </div>
              </div>

              <button
                onClick={handleRunCode}
                disabled={isRunning}
                style={{ background: isRunning ? '#94a3b8' : '#10b981', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 700, cursor: isRunning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: isRunning ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)', transition: '0.2s' }}
              >
                {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="#fff" />}
                {isRunning ? 'Đang thực thi...' : 'Chạy mã nguồn'}
              </button>
            </div>

            <div style={{ display: 'flex', flex: 1, minHeight: '650px' }}>
              {/* EDITOR */}
              <div style={{ flex: 6.5, borderRight: '1px solid var(--border-color)' }}>
                <Editor
                  height="100%"
                  defaultLanguage="python"
                  theme="vs-dark"
                  value={code}
                  onChange={(val) => setCode(val || '')}
                  options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 20, bottom: 20 }, fontLigatures: true }}
                />
              </div>

              {/* CONSOLE OUTPUT */}
              <div style={{ flex: 3.5, background: '#0f172a', color: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px 16px', background: '#1e293b', fontSize: '12px', fontWeight: 700, borderBottom: '1px solid #334155', letterSpacing: '0.5px', color: '#94a3b8' }}>
                  CONSOLE OUTPUT & PLOTS
                </div>

                <div style={{ padding: '20px', overflowY: 'auto', flex: 1, fontFamily: 'Fira Code, SFMono-Regular, monospace', fontSize: '13px', lineHeight: 1.6 }}>

                  {isRunning && (
                    <div style={{ color: '#38bdf8', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Loader2 size={14} className="animate-spin" /> $ Đang cấu hình môi trường & phân bổ task đến Ray Cluster...
                    </div>
                  )}

                  {execError && (
                    <div style={{ color: '#f87171', whiteSpace: 'pre-wrap', marginTop: '8px', background: 'rgba(248, 113, 113, 0.1)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 700 }}>
                        <AlertCircle size={16} /> LỖI THỰC THI (Runtime Error)
                      </div>
                      {execError}
                    </div>
                  )}

                  {execResult && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {/* SCALARS */}
                      {execResult.analytics?.scalars && execResult.analytics.scalars.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          {execResult.analytics.scalars.map((s, idx) => (
                            <div key={idx} style={{ background: '#1e293b', padding: '12px', borderRadius: '10px', border: '1px solid #334155' }}>
                              <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {s.name.toLowerCase().includes('time') ? <Clock size={12} /> : <Cpu size={12} />}
                                {s.name}
                              </div>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: '#38bdf8' }}>{s.value} <span style={{ fontSize: '12px', color: '#64748b' }}>{s.unit || ''}</span></div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* TEXT LOGS */}
                      {execResult.logs && execResult.logs.trim() !== "" && (
                        <div style={{ background: '#000', borderRadius: '10px', border: '1px solid #1e293b', overflow: 'hidden' }}>
                          <div style={{ background: '#1e293b', padding: '6px 12px', fontSize: '10px', color: '#94a3b8' }}>
                            STDOUT
                          </div>
                          <div style={{ padding: '16px' }}>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#e2e8f0', fontSize: '12px' }}>
                              {execResult.logs}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* IMAGES */}
                      {execResult.analytics?.images && execResult.analytics.images.length > 0 && (
                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed #334155' }}>
                          <strong style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ImageIcon size={14} /> GENERATED PLOTS ({execResult.analytics.images.length})
                          </strong>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {execResult.analytics.images.map((img: any, idx: number) => (
                              <div key={idx} style={{ background: '#fff', borderRadius: '8px', padding: '12px', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                                {img.title && <h5 style={{ color: '#1e293b', margin: '0 0 10px 0', fontSize: '13px' }}>{img.title}</h5>}
                                <img
                                  src={`data:image/png;base64,${img.data}`}
                                  alt={img.title || 'Plot'}
                                  style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px' }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* NO OUTPUT */}
                      {(!execResult.logs || execResult.logs.trim() === "") && (!execResult.analytics?.images || execResult.analytics.images.length === 0) && (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>
                          <CheckCircle2 size={32} style={{ opacity: 0.2, marginBottom: '12px', margin: '0 auto' }} />
                          <p style={{ margin: 0, fontSize: '13px', fontStyle: 'italic' }}>Thực thi hoàn tất (Không có output log hay biểu đồ nào).</p>
                        </div>
                      )}
                    </div>
                  )}

                  {!execResult && !isRunning && !execError && (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: 0.3 }}>
                      <Terminal size={48} />
                      <p style={{ marginTop: '16px', fontSize: '13px' }}>Nhấn Run Code để bắt đầu...</p>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
