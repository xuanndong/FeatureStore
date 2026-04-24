import React, { useState, useEffect, useCallback } from 'react';
import { Search, MoreHorizontal, Database } from 'lucide-react';
import { registryApi } from '@/services/registry';
import type { Entity } from '@/types';
import { Pagination } from '@/components/ui/Pagination';
import { useNotification } from '@/components/ui/Notification';

export const EntityRegistryPage: React.FC = () => {
  const { showNotification } = useNotification();
  const [data, setData] = useState<Entity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await registryApi.listEntities(search || undefined, page, 10);
      setData(res.data.items);
      setTotal(res.data.pagination.pages);
    } catch (err: any) {
      showNotification('error', err.message || 'Lỗi khi tải danh sách Entity');
    } finally {
      setLoading(false);
    }
  }, [search, page, showNotification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (ts: number) => {
    if (!ts) return 'N/A';
    return new Date(ts * 1000).toISOString().split('T')[0]; // Format: YYYY-MM-DD
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Entity Registry</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Quản lý các thực thể logic và khóa liên kết cho các tính năng AI.</p>
      </div>

      <div className="card" style={{ padding: 0 }}>

        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '360px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Tìm kiếm thực thể hoặc khóa..."
              className="form-input"
              style={{ paddingLeft: '36px', height: '36px' }}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchData()}
            />
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Hiển thị {data.length} thực thể
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Tên thực thể</th>
                <th style={{ width: '20%' }}>Khóa liên kết</th>
                <th style={{ width: '40%' }}>Mô tả</th>
                <th style={{ width: '15%' }}>Ngày tạo</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && data.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" style={{ margin: '0 auto' }}></div></td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={5}><div className="empty-state">Không có thực thể nào</div></td></tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: 'var(--surface)', padding: '6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                        <Database size={16} />
                      </div>
                      {row.name}
                    </td>
                    <td>
                      <span style={{ background: 'var(--surface)', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500 }}>
                        {row.join_key}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{row.description || '-'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>{formatDate(row.created_at)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-ghost" style={{ padding: '4px', borderRadius: '4px' }}>
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination currentPage={page} totalPages={total} onPageChange={setPage} />

    </div>
  );
};
