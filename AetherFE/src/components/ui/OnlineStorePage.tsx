import React, { useState } from 'react';
import { Search, Zap, Activity, Server, Terminal, Cpu, Globe } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';

export const OnlineStorePage: React.FC = () => {
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);

  // Giả lập hàm gọi API lấy dữ liệu thực tế từ Redis
  const handleLookup = () => {
    if (!searchId) return;
    setIsSearching(true);
    
    setTimeout(() => {
      setLookupResult({
        entity_id: searchId,
        features: {
          "last_transaction_amount": 500000,
          "is_fraud_suspected": false,
          "login_attempts_1h": 2,
          "current_balance": 12500000
        },
        timestamp: new Date().toISOString()
      });
      setIsSearching(false);
    }, 800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', height: '100%' }}>
      {/* Header: Không có nút Back vì component cha đã hiển thị */}
      <div>
        <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px 0' }}>Online Store Management</h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>
          Giám sát luồng streaming và tra cứu đặc trưng thời gian thực (Low-Latency Features).
        </p>
      </div>

      {/* Grid: Stats Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--surface)', padding: '24px' }}>
          <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '12px' }}>
            <Activity size={28} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>TỐC ĐỘ INGESTION</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>850 <span style={{fontSize: '14px', fontWeight: 400, color: 'var(--text-muted)'}}>req/s</span></div>
          </div>
        </div>
        
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--surface)', padding: '24px' }}>
          <div style={{ padding: '16px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: '12px' }}>
            <Zap size={28} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>ĐỘ TRỄ TRUNG BÌNH</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>4.2 <span style={{fontSize: '14px', fontWeight: 400, color: 'var(--text-muted)'}}>ms</span></div>
          </div>
        </div>
        
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--surface)', padding: '24px' }}>
          <div style={{ padding: '16px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', borderRadius: '12px' }}>
            <Server size={28} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>TRẠNG THÁI REDIS</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#22c55e' }}>Active</div>
          </div>
        </div>
      </div>

      {/* Main Content Split: Registry vs Lookup */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '24px', alignItems: 'start' }}>
        
        {/* Cột trái: Danh sách các luồng đang chạy */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={18} color="var(--primary)" />
              Active Online Views
            </h3>
            <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>2 Luồng</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg-secondary)', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <tr>
                  <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>TÊN VIEW</th>
                  <th style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>THỰC THỂ</th>
                  <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '16px 24px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>user_spending_realtime</td>
                  <td style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}><span className="badge">user_id</span></td>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}><StatusBadge execution="RUNNING" /></td>
                </tr>
                <tr>
                  <td style={{ padding: '16px 24px', fontWeight: 600 }}>fraud_detection_stream</td>
                  <td style={{ padding: '16px' }}><span className="badge">transaction_id</span></td>
                  <td style={{ padding: '16px 24px' }}><StatusBadge execution="RUNNING" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Cột phải: Point Lookup (Đã gộp từ Online Explorer) */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--surface)', padding: '24px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={18} color="#f59e0b" />
              Real-time Point Lookup
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
              Nhập ID thực thể để lấy mảng đặc trưng mới nhất từ Online Storage (Redis).
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ví dụ: user_123..." 
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                style={{ width: '100%', padding: '10px 14px' }}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              />
            </div>
            <button 
              onClick={handleLookup}
              disabled={isSearching || !searchId}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px', fontWeight: 600 }}
            >
              {isSearching ? <div className="spinner spinner-sm" /> : <><Terminal size={18} /> Lấy dữ liệu</>}
            </button>
          </div>

          <div style={{ 
            background: 'var(--bg)', 
            borderRadius: '12px', 
            border: '1px solid var(--border)', 
            minHeight: '240px',
            display: 'flex', 
            flexDirection: 'column'
          }}>
            {lookupResult ? (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border)', paddingBottom: '16px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>ID: {lookupResult.entity_id}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Activity size={12} /> Cập nhật lúc {new Date(lookupResult.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <pre style={{ 
                  margin: 0, 
                  fontSize: '13px', 
                  fontFamily: '"Fira Code", monospace', 
                  color: 'var(--text-primary)', 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  lineHeight: 1.6
                }}>
                  {JSON.stringify(lookupResult.features, null, 2)}
                </pre>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '32px' }}>
                <div style={{ background: 'var(--surface-hover)', padding: '16px', borderRadius: '50%', marginBottom: '16px' }}>
                  <Cpu size={32} style={{ opacity: 0.5 }} />
                </div>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Chưa có dữ liệu.</span>
                <span style={{ fontSize: '13px', marginTop: '4px' }}>Nhập ID và bấm "Lấy dữ liệu" để truy vấn.</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
