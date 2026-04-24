import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MoreVertical, Plus } from 'lucide-react';
import { studioApi } from '@/services/studio';
import type { FeatureGroup } from '@/types';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useNotification } from '@/components/ui/Notification';

export const FeatureGroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [data, setData] = useState<FeatureGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await studioApi.listFeatureGroups(search || undefined, statusFilter || undefined, page, 10);
      setData(res.data.items);
      setTotal(res.data.pagination.pages);
    } catch (err: any) {
      showNotification('error', err.message || 'Lỗi khi tải danh sách Feature Groups');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page, showNotification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // WebSocket for real-time status updates
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/studio/ws/feature-groups';
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'FEATURE_GROUP_UPDATE' && payload.data) {
          setData(prev => prev.map(fg =>
            fg.id === payload.data.id
              ? { ...fg, last_run_status: payload.data.status, updated_at: payload.data.updated_at }
              : fg
          ));
        }
      } catch (e) {
        console.error('WS Error:', e);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  // Close dropdown on outside click
  const handleClickOutside = useCallback(() => setOpenDropdownId(null), []);
  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [handleClickOutside]);

  // Memoize date formatter
  const formatDate = useCallback((ts: number) => {
    if (!ts) return 'N/A';

    return new Date(ts * 1000).toLocaleString('en-GB', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).replace(',', '');
  }, []);

  return (
    <div style={{ maxWidth: '75rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <button className="btn btn-primary" onClick={() => navigate('/feature-groups/new')}>
          <Plus size={16} /> Create new feature group
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Tìm kiếm nhóm đặc trưng..."
            className="form-input"
            style={{ paddingLeft: '40px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
          />
        </div>
        <div style={{ position: 'relative', width: '200px' }}>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="RUNNING">Đang chạy</option>
            <option value="COMPLETED">Thành công</option>
            <option value="FAILED">Thất bại</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'visible' }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Auto Schedule</th>
                <th>Status</th>
                <th>Execution</th>
                <th>Next Run At</th>
                <th>Updated Time</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Operator</th>
              </tr>
            </thead>
            <tbody>
              {loading && data.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" style={{ margin: '0 auto' }}></div></td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state">Không tìm thấy nhóm đặc trưng nào</div></td></tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 500 }}>{row.name}</td>
                    <td>{row.is_scheduled ? 'True' : 'False'}</td>
                    <td><StatusBadge status={row.status} /></td>
                    <td><StatusBadge execution={row.last_run_status} /></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{formatDate(row.next_run_at)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{formatDate(row.updated_at)}</td>
                    <td style={{ textAlign: 'center', position: 'relative' }}>
                      <button
                        className="btn-ghost"
                        style={{ padding: '6px', borderRadius: '4px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(openDropdownId === row.id ? null : row.id);
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {openDropdownId === row.id && (
                        <div className="dropdown-menu" style={{ right: '16px', top: '30px' }} onClick={(e) => e.stopPropagation()}>
                          <button className="dropdown-item" onClick={() => navigate('/entities')}>Entity Registry</button>
                          <button className="dropdown-item" onClick={() => navigate('/data-sources')}>Data Source</button>
                          <button className="dropdown-item" onClick={() => navigate('/transformations')}>Transformation</button>
                          <button className="dropdown-item" onClick={() => navigate(`/feature-groups/${row.id}`)}>View Detail</button>
                        </div>
                      )}
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
