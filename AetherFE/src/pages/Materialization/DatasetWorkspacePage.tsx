import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Terminal, Copy, Play, Loader2, Database, Table2, Layers, Share2, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { datasetsApi } from '@/services/datasets';
import { viewsApi } from '@/services/views';
import { studioApi } from '@/services/studio';
import type { ScriptExecutionData, DatasetAccessInfoData } from '@/types';

export const DatasetWorkspacePage: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams] = useSearchParams();
  const datasetType = searchParams.get('type') || 'GROUP';
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'api' | 'workspace'>('workspace');

  // State Context
  const [features, setFeatures] = useState<any[]>([]); 
  const [datasetName, setDatasetName] = useState<string>('Đang tải...');
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [endpointURL, setEndpointURL] = useState<string>("http://localhost:9000")
  const [contextLoading, setContextLoading] = useState(false);

  // State API Tab
  const [accessInfo, setAccessInfo] = useState<DatasetAccessInfoData | null>(null);
  const [loadingApi, setLoadingApi] = useState(false);

  // MẪU CODE HƯỚNG DẪN CÁCH VẼ BIỂU ĐỒ BẰNG MATPLOTLIB
  const INITIAL_CODE = `# ---------------------------------------------------------
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
    files = fs.glob(DATASET_PATH.replace("s3://", "") + "**/*.parquet")
    df = ds.dataset(files, format="parquet", filesystem=fs).to_table().to_pandas()
    
    print(f"Dataset loaded: {len(df)} rows")
    
    # VIẾT CODE CỦA BẠN TẠI ĐÂY
    # Ví dụ: 
    # aether_log.log_scalar("Metric_Name", 0.95)
    # plt.plot([1, 2, 3])
    # aether_log.log_figure("My Plot")

if __name__ == "__main__":
    main()
`;

  const [code, setCode] = useState(INITIAL_CODE);
  const [isRunning, setIsRunning] = useState(false);
  const [execResult, setExecResult] = useState<ScriptExecutionData | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

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
    try {
      const response = await datasetsApi.runExperiment({ 
        dataset_id: datasetId,
        dataset_type: datasetType as any,
        code, 
        // Yêu cầu thư viện đồ họa
        requirements: ['pandas', 'scikit-learn', 'matplotlib', 'seaborn'] 
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
search_pattern = BASE_URI.replace("s3://", "") + "**/*.parquet"
parquet_files = fs.glob(search_pattern)

if parquet_files:
    dataset = ds.dataset(parquet_files, format="parquet", filesystem=fs)
    df = dataset.to_table().to_pandas()
    print(f"Tổng số dòng: {len(df)}")
    print(df.head())`;
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: '24px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, padding: 0 }}>
        &larr; Quay lại Market
      </button>

      <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', border: '1px solid var(--border-color)', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: 'var(--text-main)' }}>Workspace: {datasetName}</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', color: 'var(--primary)' }}><Database size={20}/></div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>LOẠI DỮ LIỆU</p>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>{datasetType === 'GROUP' ? 'Feature Group' : 'Feature View'}</p>
            </div>
          </div>
          <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', color: '#10b981' }}><Layers size={20}/></div>
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

      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
        <button onClick={() => setActiveTab('api')} style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600, fontSize: '15px', borderBottom: activeTab === 'api' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'api' ? 'var(--primary)' : 'var(--text-secondary)' }}>
          <Share2 size={18} /> Get Pre-signed URL
        </button>
        <button onClick={() => setActiveTab('workspace')} style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600, fontSize: '15px', borderBottom: activeTab === 'workspace' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'workspace' ? 'var(--primary)' : 'var(--text-secondary)' }}>
          <Terminal size={18} /> Train In-system
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        {activeTab === 'api' ? (
          <div style={{ padding: '32px' }}>
            <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <button 
                onClick={handleGenerateUrl} 
                disabled={loadingApi}
                style={{ 
                  background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 20px', 
                  borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', 
                  cursor: loadingApi ? 'not-allowed' : 'pointer', fontSize: '14px' 
                }}
              >
                {loadingApi ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="#fff" />} Generate Pre-signed URL
              </button>
            </div>

            {accessInfo && (
              <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                  <h4 style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', fontSize: '15px' }}>
                    <Share2 size={18} /> Thành công! Thông tin xác thực đã được tạo.
                  </h4>
                  <p style={{ margin: 0, fontSize: '14px', color: '#047857' }}>Hết hạn vào lúc: <strong>{new Date(accessInfo.expires_at * 1000).toLocaleString('vi-VN')}</strong></p>
                </div>

                <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '14px 16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <ShieldCheck size={20} color="#2563eb" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#1d4ed8', fontWeight: 600 }}>Chính sách bảo mật giới hạn không gian</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#1e40af', lineHeight: 1.5 }}>
                      Thông tin xác thực (Key) được cấp phát là loại dùng một lần và bị giới hạn quyền. Bạn chỉ có quyền truy cập duy nhất bộ dữ liệu <strong>{datasetName}</strong>.
                    </p>
                  </div>
                </div>

                <div style={{ position: 'relative', background: '#1e1e1e', borderRadius: '12px', padding: '24px', border: '1px solid #333' }}>
                  <button 
                    onClick={() => navigator.clipboard.writeText(generatePythonSnippet())} 
                    style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500 }}
                  >
                    <Copy size={16} /> Copy Code
                  </button>
                  <pre style={{ margin: 0, color: '#e5e5e5', fontFamily: 'monospace', fontSize: '14px' }}>
                    <code>{generatePythonSnippet()}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'auto', minHeight: '650px' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}><Terminal size={16}/> Monaco Workspace</span>
                <span style={{ fontSize: '12px', color: 'var(--primary)', background: 'var(--primary-light)', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>Python 3.10 • Ray Cluster</span>
              </div>
              <button 
                onClick={handleRunCode} 
                disabled={isRunning} 
                style={{ 
                  background: isRunning ? '#cbd5e1' : '#10b981', color: '#fff', border: 'none', 
                  padding: '10px 20px', borderRadius: '8px', fontWeight: 600, display: 'flex', 
                  alignItems: 'center', gap: '8px', cursor: isRunning ? 'not-allowed' : 'pointer', 
                  fontSize: '14px', transition: 'background 0.2s' 
                }}
              >
                {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="#fff" />} 
                {isRunning ? 'Executing...' : 'Run / Plot'}
              </button>
            </div>
            
            <div style={{ display: 'flex', flex: 1, minHeight: '600px' }}>
              <div style={{ flex: 1, borderRight: '1px solid var(--border-color)', minWidth: '55%' }}>
                <Editor 
                  height="100%" 
                  defaultLanguage="python" 
                  theme="vs-dark" 
                  value={code} 
                  onChange={(val) => setCode(val || '')} 
                  options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 20, bottom: 20 }, fontLigatures: true }} 
                />
              </div>
              
              <div style={{ flex: 3.5, background: '#1e1e1e', color: '#fff', display: 'flex', flexDirection: 'column', minWidth: '45%' }}>
                <div style={{ padding: '12px 16px', background: '#2d2d2d', fontSize: '12px', fontWeight: 600, borderBottom: '1px solid #404040', letterSpacing: '0.5px' }}>
                  CONSOLE OUTPUT & PLOTS
                </div>
                
                <div style={{ padding: '20px', overflowY: 'auto', flex: 1, fontFamily: 'SFMono-Regular, Consolas, monospace', fontSize: '13px', lineHeight: 1.6 }}>
                  {!execResult && !isRunning && !execError && (
                     <span style={{ color: '#888' }}><span style={{ color: '#fbbf24' }}>$</span> Sẵn sàng nhận mã... In kết quả hoặc vẽ biểu đồ để xem tại đây.</span>
                  )}
                  {isRunning && (
                     <span style={{ color: '#60a5fa' }}><span style={{ color: '#fbbf24' }}>$</span> Đang thực thi mã nguồn...</span>
                  )}
                  {execError && (
                     <div style={{ color: '#ef4444', whiteSpace: 'pre-wrap', marginTop: '8px', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid #ef4444' }}>{execError}</div>
                  )}
                  
                  {execResult && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      
                      {/* 1. HIỂN THỊ TERMINAL LOG CỦA NGƯỜI DÙNG */}
                      {execResult.logs && execResult.logs.trim() !== "" && (
                        <div style={{ background: '#000', borderRadius: '8px', border: '1px solid #333', overflow: 'hidden' }}>
                          <div style={{ background: '#1a1a1a', padding: '8px 16px', fontSize: '11px', color: '#888', borderBottom: '1px solid #333' }}>
                              STDOUT / STDERR
                          </div>
                          <div style={{ padding: '16px' }}>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#e5e5e5' }}>
                              {execResult.logs}
                            </pre>
                          </div>
                        </div>
                      )}
                      
                      {/* 2. HIỂN THỊ CÁC THÔNG SỐ ĐO LƯỜNG CƠ BẢN (Time, RAM) */}
                      {execResult.analytics?.scalars && execResult.analytics.scalars.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                           {execResult.analytics.scalars.map((s, idx) => (
                              <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                 <div style={{ fontSize: '11px', color: '#a3a3a3', textTransform: 'uppercase' }}>{s.name}</div>
                                 <div style={{ fontSize: '15px', fontWeight: 600, color: '#10b981' }}>{s.value} <span style={{ fontSize: '12px' }}>{s.unit || ''}</span></div>
                              </div>
                           ))}
                        </div>
                      )}

                      {/* 3. HIỂN THỊ BIỂU ĐỒ HÌNH ẢNH (BASE64 TỪ MATPLOTLIB) */}
                      {execResult.analytics?.images && execResult.analytics.images.length > 0 && (
                         <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed #404040' }}>
                            <strong style={{ color: '#60a5fa', fontSize: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <ImageIcon size={18} /> Kết quả Biểu đồ (Plots)
                            </strong>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                               {execResult.analytics.images.map((img: any, idx: number) => (
                                 <div key={idx} style={{ background: '#fff', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                                    {img.title && <h5 style={{ color: '#333', margin: '0 0 12px 0', fontSize: '14px' }}>{img.title}</h5>}
                                    <img 
                                      src={`data:image/png;base64,${img.data}`} 
                                      alt={img.title || 'Plot'} 
                                      style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px', border: '1px solid #eee' }} 
                                    />
                                 </div>
                               ))}
                            </div>
                         </div>
                      )}

                      {/* 4. EDGE CASE: KHÔNG CÓ LOGS VÀ KHÔNG CÓ ẢNH */}
                      {(!execResult.logs || execResult.logs.trim() === "") && (!execResult.analytics?.images || execResult.analytics.images.length === 0) && (
                        <div style={{ color: '#888', fontStyle: 'italic', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                          Tiến trình chạy thành công nhưng không tạo ra thông điệp (print) hay biểu đồ nào.
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
