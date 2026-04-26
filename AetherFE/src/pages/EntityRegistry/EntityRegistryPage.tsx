import React, { useState, useCallback } from 'react';
import { useEntityFetch } from '@/hooks';
import { Pagination } from '@/components/ui/Pagination';
import { useNotification } from '@/components/ui/Notification';
import { ErrorState } from '@/components/ui/ErrorState';

import { EntityCard } from '@/pages/EntityRegistry/EntityCard';
import { EntitySearch } from '@/pages/EntityRegistry/EntitySearch';
import { useDebounce } from '@/hooks/useDebounce';


export const EntityRegistryPage: React.FC = () => {
  const { showNotification } = useNotification();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const debouncedSearch = useDebounce(search, 500);

  const handleError = useCallback((msg: string) => showNotification('error', msg), [showNotification]);
  
  const { data, totalPages: total, loading, error, fetchData } = useEntityFetch(
    debouncedSearch, 
    page, 
    handleError
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const formatDate = useCallback((ts: number) => {
    if (!ts) return 'N/A';
    return new Date(ts * 1000).toLocaleDateString('en-GB');
  }, []);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Entity Registry</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Quản lý các thực thể logic và khóa liên kết để đồng bộ dữ liệu trên toàn hệ thống AetherFS.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
          <EntitySearch value={search} onChange={handleSearchChange} />
          {/* <button className="btn btn-primary" style={{ height: '40px' }}>
            <Plus size={16} /> Add Entity
          </button> */}
        </div>
      </div>

      {/* Main Content */}
      {error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : (
        <>
          {loading && data.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <div className="spinner"></div>
            </div>
          ) : data.length === 0 ? (
            <div className="empty-state" style={{ padding: '80px 0' }}>
              Không tìm thấy thực thể nào khớp với yêu cầu của bạn.
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
              gap: '24px' 
            }}>
              {data.map((entity) => (
                <EntityCard 
                  key={entity.id} 
                  item={entity} 
                  formatDate={formatDate} 
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Footer / Pagination */}
      {total > 1 && (
        <div style={{ marginTop: '12px' }}>
          <Pagination 
            currentPage={page} 
            totalPages={total} 
            onPageChange={setPage} 
          />
        </div>
      )}
    </div>
  );
};
