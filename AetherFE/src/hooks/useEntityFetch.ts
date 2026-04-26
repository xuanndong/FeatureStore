import { useState, useCallback, useEffect } from 'react';
import { registryApi } from '@/services/registry';
import type { Entity } from '@/types';

interface UseEntityFetchReturn {
  data: Entity[];
  totalPages: number;
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
}

export const useEntityFetch = (
  search: string,
  page: number,
  onError: (message: string) => void
): UseEntityFetchReturn => {
  const [data, setData] = useState<Entity[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await registryApi.listEntities(search || undefined, page, 9);
      setData(res.data.items);
      setTotalPages(res.data.pagination.total_pages);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Hệ thống hiện không phản hồi. Vui lòng thử lại sau.';
      setError(message);
      onError(message);
    } finally {
      setLoading(false);
    }
  }, [search, page, onError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  return { data, totalPages, loading, error, fetchData };
};
