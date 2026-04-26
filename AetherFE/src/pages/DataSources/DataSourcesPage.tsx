import React, { useState, useCallback } from 'react';
import { useDataSourcesFetch, useTimeFormatting } from '@/hooks';
import { Pagination } from '@/components/ui/Pagination';
import { useNotification } from '@/components/ui/Notification';
import { DataSourceSearch } from '@/pages/DataSources/DataSourceSearch';
import { DataSourceCard } from '@/pages/DataSources/DataSourceCard';
import { useDebounce } from '@/hooks/useDebounce';


const DATASOURCES_PAGE_SIZE = 12;

export const DataSourcesPage: React.FC = () => {
  const { showNotification } = useNotification();
  const { getTimeAgo } = useTimeFormatting();
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const debouncedSearch = useDebounce(search, 500);

  const handleError = useCallback(
    (message: string) => {
      showNotification('error', message);
    },
    [showNotification]
  );

  const { data, total, loading, fetchData } = useDataSourcesFetch(
    debouncedSearch,
    page,
    DATASOURCES_PAGE_SIZE,
    handleError
  );

  const handleSearchChange = (newValue: string) => {
    setSearch(newValue);
    setPage(1);
  };

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            Data Sources
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Quản lý các kết nối lưu trữ Batch và luồng Stream cho Feature Store.
          </p>
        </div>
        <DataSourceSearch
          value={search}
          onChange={handleSearchChange}
          onSearch={fetchData}
        />
      </div>

      {/* Content Section */}
      {loading && data.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="spinner"></div>
        </div>
      ) : data.length === 0 ? (
        <div className="empty-state">Không có nguồn dữ liệu nào khớp với tìm kiếm</div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '20px',
          }}
        >
          {data.map((item) => (
            <DataSourceCard
              key={item.id}
              item={item}
              timeAgo={getTimeAgo(item.updated_at)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 1 && (
        <Pagination
          currentPage={page}
          totalPages={total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
};
