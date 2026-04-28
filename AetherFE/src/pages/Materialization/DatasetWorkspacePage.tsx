import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Link, Terminal, Copy, Play, Loader2 } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { datasetsApi } from '@/services/datasets';
import type { DatasetAccessInfoData, ScriptExecutionData } from '@/types';

export const DatasetWorkspacePage: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams] = useSearchParams();
  const datasetType = searchParams.get('type') || 'GROUP';
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'api' | 'workspace'>('api');

  // State API Tab
  const [accessInfo, setAccessInfo] = useState<DatasetAccessInfoData | null>(null);
  const [loadingApi, setLoadingApi] = useState(false);

  // State Monaco Tab
  const INITIAL_CODE = `import pandas as pd\n\n# Bắt đầu thực thi mã trên Ray Cluster...\n# Sử dụng aether_log để ghi nhận thông số\n\nprint("Hello AetherFS!")\n`;
  const [code, setCode] = useState(INITIAL_CODE);
  const [isRunning, setIsRunning] = useState(false);
  const [execResult, setExecResult] = useState<ScriptExecutionData | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'api' && datasetId && !accessInfo) {
      setLoadingApi(true);
      datasetsApi.getAccessInfo(datasetId, datasetType)
        .then(res => setAccessInfo(res.data))
        .catch(err => console.error(err))
        .finally(() => setLoadingApi(false));
    }
  }, [activeTab, datasetId, datasetType, accessInfo]);

  const handleRunCode = async () => {
    setIsRunning(true);
    setExecResult(null);
    setExecError(null);
    try {
      const response = await datasetsApi.runExperiment({ code, requirements: ['pandas'] });
      setExecResult(response.data);
    } catch (error: any) {
      setExecError(error.response?.data?.detail || error.message || "Lỗi thực thi.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: '16px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, padding: 0 }}>
        ← Quay lại Market
      </button>
      <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Workspace: Dataset #{datasetId?.slice(0,8)}</h2>

      <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
        <button onClick={() => setActiveTab('api')} style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 500, borderBottom: activeTab === 'api' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'api' ? 'var(--primary)' : 'var(--text-secondary)' }}>
          <Link size={18} /> API Integration
        </button>
        <button onClick={() => setActiveTab('workspace')} style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 500, borderBottom: activeTab === 'workspace' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'workspace' ? 'var(--primary)' : 'var(--text-secondary)' }}>
          <Terminal size={18} /> Aether Workspace
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {activeTab === 'api' ? (
          <div style={{ padding: '24px' }}>
            {loadingApi ? <div>Đang tạo URL bảo mật...</div> : !accessInfo ? <div style={{color: 'red'}}>Lỗi tải thông tin truy cập</div> : (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Tích hợp Python / Jupyter</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Mã này chứa Pre-signed URL (Hết hạn: {new Date(accessInfo.expires_at * 1000).toLocaleString('vi-VN')}).</p>
                <div style={{ position: 'relative', background: '#1e1e1e', borderRadius: '8px', padding: '20px' }}>
                  <button onClick={() => navigator.clipboard.writeText(`import pandas as pd\nURL = "${accessInfo.access_url}"\ndf = pd.read_parquet(URL)\nprint(df.head())`)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}><Copy size={16} /></button>
                  <pre style={{ margin: 0, color: '#d4d4d4', fontFamily: 'monospace', fontSize: '14px', overflowX: 'auto' }}>
                    <code>import pandas as pd{'\n\n'}URL = "{accessInfo.access_url}"{'\n\n'}df = pd.read_parquet(URL){'\n'}print(df.head())</code>
                  </pre>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
              <span style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-secondary)' }}>Môi trường: Python 3.10 • Ray Cluster</span>
              <button onClick={handleRunCode} disabled={isRunning} style={{ background: isRunning ? '#cbd5e1' : '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: isRunning ? 'not-allowed' : 'pointer' }}>
                {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} {isRunning ? 'Đang thực thi...' : 'Run Script'}
              </button>
            </div>
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              <div style={{ flex: 1, borderRight: '1px solid var(--border-color)' }}>
                <Editor height="100%" defaultLanguage="python" theme="vs-dark" value={code} onChange={(val) => setCode(val || '')} options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 16 } }} />
              </div>
              <div style={{ flex: 1, background: '#1e1e1e', color: '#fff', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '8px 16px', background: '#2d2d2d', fontSize: '12px', fontWeight: 600, borderBottom: '1px solid #404040' }}>TERMINAL OUTPUT</div>
                <div style={{ padding: '16px', overflowY: 'auto', flex: 1, fontFamily: 'monospace', fontSize: '13px' }}>
                  {!execResult && !isRunning && !execError && <span style={{ color: '#888' }}>&gt; Chờ lệnh thực thi...</span>}
                  {isRunning && <span style={{ color: '#fbbf24' }}>&gt; Đang gửi mã đến Ray Worker...</span>}
                  {execError && <div style={{ color: '#ef4444', whiteSpace: 'pre-wrap', marginTop: '8px' }}>{execError}</div>}
                  {execResult && (
                    <div>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#d4d4d4' }}>{execResult.logs}</pre>
                      {execResult.analytics?.scalars && execResult.analytics.scalars.length > 0 && (
                        <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderLeft: '3px solid #10b981' }}>
                          <strong style={{ color: '#10b981' }}>[Analytics]</strong><br/><span style={{ color: '#d4d4d4' }}>Đã thu thập {execResult.analytics.scalars.length} KPIs.</span>
                        </div>
                      )}
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
