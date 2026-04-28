import { useState, useEffect, useCallback } from 'react';
import { datasetsApi } from '@/services/datasets';
import type { DatasetItem } from '@/types';

export const useDatasetFetch = (
  search: string, 
  page: number, 
  onError: (msg: string) => void
) => {
  const [data, setData] = useState<DatasetItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await datasetsApi.listReadyDatasets(undefined, search, page, 10);
      setData(response.data.items);
      setTotalPages(response.data.pagination.total_pages);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || "Không thể tải danh sách tập dữ liệu.";
      setError(errorMsg);
      onError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [search, page, onError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, totalPages, loading, error, fetchData };
};
