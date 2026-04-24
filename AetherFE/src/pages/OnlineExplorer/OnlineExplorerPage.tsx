import React, { useState, useEffect } from 'react';
import { Search, Database, Clock, Info, CheckCircle2 } from 'lucide-react';
import { servingApi } from '@/services/serving';
import { useNotification } from '@/components/ui/Notification';

export const OnlineExplorerPage: React.FC = () => {
  const { showNotification } = useNotification();
  const [status, setStatus] = useState<{ status: string, latency_ms: number } | null>(null);

  const [entityName, setEntityName] = useState('User');
  const [recordId, setRecordId] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [hasQueried, setHasQueried] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await servingApi.checkRedisStatus();
        setStatus(res.data);
      } catch (err) {
        setStatus({ status: 'Disconnected', latency_ms: 0 });
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const handleQuery = async () => {
    if (!entityName || !recordId) {
      showNotification('error', 'Vui lòng nhập Entity và Record ID');
      return;
    }
    try {
      setLoading(true);
      setHasQueried(true);
      const res = await servingApi.fetchOnlineFeatures({ entity_name: entityName, record_id: recordId });
      setResult(res.data);
    } catch (err: any) {
      setResult(null);
      showNotification('error', err.message || 'Không tìm thấy dữ liệu hoặc lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '56.25rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem', paddingTop: '1.25rem' }}>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 700, marginBottom: '0.75rem' }}>Online Explorer</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(0.875rem, 2vw, 0.9375rem)' }}>Khám phá và xác minh các giá trị đặc trưng trực tuyến trong Redis cluster.</p>
      </div>

      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-md)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        <div className="hide-on-mobile" style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem' }}>
          {/* Entity field */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', borderRight: '1px solid var(--border)', gap: '0.5rem', flexShrink: 0 }}>
            <Database size={18} color="var(--text-muted)" />
            <input
              type="text"
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '7.5rem', fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.875rem' }}
              placeholder="Entity Name"
              value={entityName}
              onChange={e => setEntityName(e.target.value)}
            />
          </div>
          {/* Record ID field */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', flex: 1, gap: '0.5rem' }}>
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-primary)', fontSize: '0.875rem' }}
              placeholder="Nhập record_id (vd: user_9921)..."
              value={recordId}
              onChange={e => setRecordId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuery()}
            />
          </div>
          {/* Query button */}
          <button
            className="btn btn-secondary"
            style={{ background: 'var(--text-primary)', color: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: '0 1.5rem', flexShrink: 0 }}
            onClick={handleQuery}
            disabled={loading}
          >
            {loading
              ? <div className="spinner spinner-sm" style={{ borderColor: 'var(--bg)', borderTopColor: 'var(--text-primary)' }} />
              : <>⚡ Query Redis</>}
          </button>
        </div>

        {/* Stacked layout — visible on mobile only (CONVENTION Rule 1) */}
        <div className="show-mobile-only" style={{ flexDirection: 'column', padding: '0.75rem', gap: '0.5rem' }}>
          {/* Entity field */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg)' }}>
            <Database size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.875rem' }}
              placeholder="Entity Name"
              value={entityName}
              onChange={e => setEntityName(e.target.value)}
            />
          </div>
          {/* Record ID field */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg)' }}>
            <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, color: 'var(--text-primary)', fontSize: '0.875rem' }}
              placeholder="Nhập record_id (vd: user_9921)..."
              value={recordId}
              onChange={e => setRecordId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuery()}
            />
          </div>
          {/* Query button — full width on mobile */}
          <button
            className="btn btn-secondary"
            style={{ background: 'var(--text-primary)', color: 'var(--bg)', borderRadius: 'var(--radius-md)', width: '100%', justifyContent: 'center', padding: '0.75rem' }}
            onClick={handleQuery}
            disabled={loading}
          >
            {loading
              ? <div className="spinner spinner-sm" style={{ borderColor: 'var(--bg)', borderTopColor: 'var(--text-primary)' }} />
              : <>Query Redis</>}
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: status?.status === 'OK' ? '#10b981' : '#ef4444', flexShrink: 0 }} />
          Redis Cluster: {status?.status === 'OK' ? 'Connected' : 'Disconnected'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Clock size={14} /> Avg Latency: {status?.latency_ms || 0}ms
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Info size={14} /> Hướng dẫn cú pháp
        </div>
      </div>

      {!hasQueried ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '40px', gap: '32px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Search size={32} color="var(--text-muted)" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Sẵn sàng khám phá dữ liệu trực tuyến</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Chọn một thực thể (Entity) và nhập mã định danh (ID) để<br />truy vấn các giá trị tính năng mới nhất từ Redis cluster.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(12rem, 100%), 1fr))', gap: '1.25rem', width: '100%' }}>
            {[
              { num: 1, title: 'Chọn thực thể', desc: 'Ví dụ: User, Product, Merchant' },
              { num: 2, title: 'Nhập Key ID', desc: 'Mã định danh duy nhất của thực thể' },
              { num: 3, title: 'Xem kết quả', desc: 'Lấy dữ liệu thời gian thực từ online store' }
            ].map(step => (
              <div key={step.num} style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>{step.num}</div>
                <h3 style={{ fontSize: '14px', fontWeight: 600 }}>{step.title}</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
          <div className="info-box" style={{ width: '100%' }}>
            <Info size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '4px' }}>Lưu ý về đồng bộ hóa</div>
              <div style={{ color: 'var(--text-secondary)' }}>Dữ liệu hiển thị ở đây được lấy trực tiếp từ Redis Online Store. Nếu bạn không thấy thay đổi mới nhất, hãy kiểm tra trạng thái tiến trình để đảm bảo dữ liệu đã được đẩy từ Offline Store lên Online Store.</div>
            </div>
          </div>
        </div>
      ) : result ? (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <CheckCircle2 size={18} color="#10b981" /> Kết quả truy vấn cho {entityName} ({recordId})
          </div>
          <div style={{ padding: '20px', background: 'var(--bg)', fontFamily: 'monospace', fontSize: '13px' }}>
            <pre style={{ margin: 0, color: 'var(--text-primary)' }}>{JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      ) : (
        <div className="empty-state">Không tìm thấy dữ liệu</div>
      )}

    </div>
  );
};
