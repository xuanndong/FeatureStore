import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatasetFetch } from '@/hooks/useDatasetFetch';
import { Pagination } from '@/components/ui/Pagination';
import { useNotification } from '@/components/ui/Notification';
import { ErrorState } from '@/components/ui/ErrorState';
import { useDebounce } from '@/hooks/useDebounce';

import { DatasetCard } from '@/pages/Materialization/DatasetCard';
import { DatasetSearch } from '@/pages/Materialization/DatasetSearch';

interface FeatureMarketPageProps {
  mode?: 'OFFLINE' | 'ONLINE';
}

export const FeatureMarketPage: React.FC<FeatureMarketPageProps> = ({ mode = 'OFFLINE' }) => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const handleError = useCallback((msg: string) => showNotification('error', msg), [showNotification]);
  
  const { data, totalPages: total, loading, error, fetchData } = useDatasetFetch(
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
    return new Date(ts * 1000).toLocaleDateString('vi-VN');
  }, []);

  const handleDatasetClick = (datasetId: string, datasetType: string) => {
    navigate(`/materialization/workspace/${datasetId}?type=${datasetType}&mode=${mode}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            {mode === 'OFFLINE' ? 'Offline Feature Market' : 'Online Feature Market'}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {mode === 'OFFLINE' 
              ? 'Khám phá, tích hợp hoặc thực thi mã nguồn huấn luyện trực tiếp trên các tập dữ liệu Materialized.'
              : 'Khám phá và lấy thông tin kết nối thời gian thực đến các đặc trưng trên Redis Stack.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
          <DatasetSearch value={search} onChange={handleSearchChange} placeholder="Tìm kiếm tập dữ liệu..." />
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : (
        <>
          {loading && data.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner"></div></div>
          ) : data.length === 0 ? (
            <div className="empty-state" style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              Không tìm thấy tập dữ liệu nào khớp với yêu cầu.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
              {data.map((dataset) => (
                <DatasetCard key={dataset.dataset_id} item={dataset} formatDate={formatDate} onClick={handleDatasetClick} />
              ))}
            </div>
          )}
        </>
      )}

      {total > 1 && (
        <div style={{ marginTop: '12px' }}>
          <Pagination currentPage={page} totalPages={total} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
};
