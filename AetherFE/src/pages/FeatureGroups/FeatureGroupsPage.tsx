import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import { useFeatureGroupsFetch } from '@/hooks';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useNotification } from '@/components/ui/Notification';
import { ErrorState } from '@/components/ui/ErrorState';
import { useDebounce } from '@/hooks/useDebounce';


export const FeatureGroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  // States
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const debouncedSearch = useDebounce(search, 500); // 500ms

  const handleError = useCallback((msg: string) => showNotification('error', msg), [showNotification]);

  const { data, totalPages, loading, error, fetchData } = useFeatureGroupsFetch(
    debouncedSearch, 
    statusFilter, 
    page, 
    handleError
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

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
        <button className="btn btn-primary" onClick={() => navigate('/feature-groups/new')} style={{padding: '1.2rem'}}>
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
            onChange={handleSearchChange}
          />
        </div>
        <div style={{ position: 'relative', width: '200px' }}>
          <select
            className="form-select"
            value={statusFilter}
            onChange={handleStatusChange}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="RUNNING">Đang chạy</option>
            <option value="COMPLETED">Thành công</option>
            <option value="FAILED">Thất bại</option>
          </select>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : (
        <div className="card" style={{ padding: 0 }}>
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
                </tr>
              </thead>
              <tbody>
                {loading && data.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                      <div className="spinner" style={{ margin: '0 auto' }}></div>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">Không tìm thấy nhóm đặc trưng nào</div>
                    </td>
                  </tr>
                ) : (
                  data.map((row) => (
                    <tr 
                      key={row.id} 
                      onClick={() => navigate(`/feature-groups/${row.id}`)}
                      style={{ cursor: 'pointer' }}
                      className="table-row-hover"
                    >
                      <td style={{ fontWeight: 500 }}>{row.name}</td>
                      <td>{row.is_scheduled ? 'True' : 'False'}</td>
                      <td><StatusBadge status={row.status} /></td>
                      <td><StatusBadge execution={row.last_run_status} /></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{row.next_run_at ? formatDate(row.next_run_at) : '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatDate(row.updated_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && data.length > 0 && (
        <Pagination 
          currentPage={page} 
          totalPages={totalPages}
          onPageChange={setPage} 
        />
      )}
    </div>
  );
};
