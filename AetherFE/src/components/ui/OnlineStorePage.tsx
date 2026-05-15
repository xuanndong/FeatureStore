import React, { useState, useEffect } from 'react';
import { Database, Copy, RefreshCcw, Key, Code, X, Search, Terminal } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { servingApi } from '@/services/serving';

export const OnlineStorePage: React.FC = () => {
  const [keys, setKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Side Panel State
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [featureData, setFeatureData] = useState<any>(null);
  const [loadingFeature, setLoadingFeature] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await servingApi.getRedisKeys();
      if (res.data) {
        setKeys(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleViewData = async (key: string) => {
    setSelectedKey(key);
    setLoadingFeature(true);
    setFeatureData(null);
    try {
      const res = await servingApi.getRedisFeature(key);
      if (res.data) {
        setFeatureData(res.data);
      } else {
        setFeatureData({ message: "No data found for this key." });
      }
    } catch (e) {
      console.error(e);
      setFeatureData({ error: "Failed to load data." });
    } finally {
      setLoadingFeature(false);
    }
  };

  const pythonSnippet = `import redis
import json

# Khởi tạo kết nối đến Redis Stack
redis_client = redis.Redis(
    host='localhost', 
    port=6379, 
    decode_responses=True
)

# Lấy dữ liệu Real-time (Low-Latency Point Lookup)
# Thay đổi 'redis_key' bằng một khóa tồn tại (Xem danh sách bên dưới)
redis_key = "fs:feature_group_name:entity_key:value"
raw_data = redis_client.json().get(redis_key)

if raw_data:
    print(f"Đã lấy được Online Features cho khóa {redis_key}:")
    print(json.dumps(raw_data, indent=2))
else:
    print(f"Không tìm thấy dữ liệu")
`;

  const filteredKeys = keys.filter(k => k.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
      {/* (Main Content) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>

        <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={24} color="var(--primary)" /> Python Connection Snippet
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
            Sử dụng đoạn mã này để kết nối trực tiếp đến Redis Server và query dữ liệu đặc trưng theo thời gian thực.
          </p>
          <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', height: '320px' }}>
            <button
              onClick={() => navigator.clipboard.writeText(pythonSnippet)}
              style={{ position: 'absolute', zIndex: 10, top: '16px', right: '16px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500 }}
            >
              <Copy size={16} /> Copy Code
            </button>
            <Editor
              height="100%"
              defaultLanguage="python"
              theme="vs-dark"
              value={pythonSnippet}
              options={{ minimap: { enabled: false }, readOnly: true, fontSize: 14, padding: { top: 20, bottom: 20 } }}
            />
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={20} color="#f59e0b" /> Redis Keys ({keys.length})
            </h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', top: '10px', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Lọc key..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px', outline: 'none' }}
                />
              </div>
              <button onClick={fetchKeys} disabled={loading} style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: 'var(--bg-secondary)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <tr>
                  <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>REDIS KEY</th>
                  <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', width: '150px' }}>HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody>
                {filteredKeys.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Không có key nào trong Redis khớp với từ khóa.
                    </td>
                  </tr>
                ) : (
                  filteredKeys.map(k => (
                    <tr key={k} style={{ background: selectedKey === k ? 'rgba(59, 130, 246, 0.05)' : 'transparent', transition: '0.2s' }}>
                      <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', fontFamily: 'monospace', fontSize: '14px', color: 'var(--text-main)', fontWeight: selectedKey === k ? 600 : 400 }}>
                        {k}
                      </td>
                      <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
                        <button
                          onClick={() => handleViewData(k)}
                          style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', padding: '6px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Code size={14} /> Xem Data
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* (Side Panel) */}
      {selectedKey && (
        <div style={{ width: '420px', background: '#fff', borderRadius: '16px', border: '1px solid var(--primary)', boxShadow: '0 8px 30px rgba(59, 130, 246, 0.1)', overflow: 'hidden', position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
          <div style={{ padding: '20px 24px', background: 'var(--primary)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ overflow: 'hidden' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={18} /> Chi Tiết Dữ Liệu
              </h3>
              <div style={{ fontSize: '12px', opacity: 0.9, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedKey}
              </div>
            </div>
            <button onClick={() => setSelectedKey(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', background: '#1e1e1e', padding: '24px' }}>
            {loadingFeature ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: '#888' }}>
                <div className="spinner"></div>
                <span style={{ fontSize: '13px' }}>Đang tải dữ liệu JSON...</span>
              </div>
            ) : featureData ? (
              <pre style={{ margin: 0, fontFamily: '"Fira Code", monospace', fontSize: '13px', color: '#d4d4d4', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                {JSON.stringify(featureData, null, 2)}
              </pre>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: '#555' }}>
                <Terminal size={32} />
                <span style={{ fontSize: '13px' }}>Không có dữ liệu</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
