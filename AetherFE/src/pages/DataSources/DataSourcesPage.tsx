import React, { useState, useEffect, useCallback } from 'react';
import { Search, ExternalLink, Database, Activity } from 'lucide-react';
import { registryApi } from '@/services/registry';
import type { DataSource } from '@/types';
import { Pagination } from '@/components/ui/Pagination';
import { useNotification } from '@/components/ui/Notification';
import { TypeBadge } from '@/components/ui/StatusBadge';

export const DataSourcesPage: React.FC = () => {
  const { showNotification } = useNotification();
  const [data, setData] = useState<DataSource[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await registryApi.listDataSources(search || undefined, page, 12);
      setData(res.data.items);
      setTotal(res.data.pagination.pages);
    } catch (err: any) {
      showNotification('error', err.message || 'Lỗi khi tải danh sách Data Sources');
    } finally {
      setLoading(false);
    }
  }, [search, page, showNotification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTimeAgo = (ts: number) => {
    if (!ts) return 'N/A';
    const seconds = Math.floor(Date.now() / 1000) - ts;
    if (seconds < 60) return 'Vừa xong';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Data Sources</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Quản lý các kết nối lưu trữ Batch và luồng Stream cho Feature Store.</p>
        </div>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Tìm kiếm nguồn dữ liệu..."
            className="form-input"
            style={{ paddingLeft: '36px', height: '38px', borderRadius: '20px' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchData()}
          />
        </div>
      </div>

      {loading && data.length === 0 ? (
        <div className="spinner" style={{ margin: '40px auto' }}></div>
      ) : data.length === 0 ? (
        <div className="empty-state">Không có nguồn dữ liệu nào</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {data.map((item) => (
            <div key={item.id} className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>

              {/* Card Header */}
              <div style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{
                  background: item.source_type === 'BATCH' ? '#ede9fe' : '#d1fae5',
                  color: item.source_type === 'BATCH' ? '#5b21b6' : '#065f46',
                  width: '40px', height: '40px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {item.source_type === 'BATCH' ? <Database size={20} /> : <Activity size={20} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name}
                    </h3>
                    <TypeBadge label={item.source_type} variant={item.source_type === 'BATCH' ? 'batch' : 'stream'} />
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Provider • {item.source_format}
                  </div>
                </div>
              </div>

              {/* Location URI */}
              <div style={{ padding: '0 20px 20px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.05em' }}>LOCATION URI</div>
                <div style={{
                  background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '6px',
                  fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  wordBreak: 'break-all'
                }}>
                  {item.location_uri}
                  <ExternalLink size={14} style={{ flexShrink: 0, marginLeft: '8px', cursor: 'pointer', opacity: 0.5 }} />
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottomLeftRadius: 'var(--radius-md)', borderBottomRightRadius: 'var(--radius-md)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500 }}>
                  <span className={`status-dot ${item.connection_status ? 'connected' : 'disconnected'}`}></span>
                  {item.connection_status ? 'Đã kết nối' : 'Mất kết nối'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Cập nhật: {getTimeAgo(item.updated_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalPages={total} onPageChange={setPage} />

    </div>
  );
};
