import { useState, useCallback, useEffect } from 'react';
import { registryApi } from '@/services/registry';
import type { DataSource } from '@/types';

interface UseDataSourcesFetchReturn {
  data: DataSource[];
  total: number;
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
}

export const useDataSourcesFetch = (
  search: string,
  page: number,
  limit: number,
  onError: (message: string) => void
): UseDataSourcesFetchReturn => {
  const [data, setData] = useState<DataSource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await registryApi.listDataSources(search || undefined, page, limit);
      setData(res.data.items);
      setTotal(res.data.pagination.total_pages);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Hệ thống hiện không phản hồi. Vui lòng thử lại sau.';
      setError(message);
      onError(message);
    } finally {
      setLoading(false);
    }
  }, [search, page, limit, onError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  return { data, total, loading, error, fetchData };
};
