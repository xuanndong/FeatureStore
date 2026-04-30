import { useState, useCallback, useEffect } from 'react';
import { viewsApi } from '@/services/views';
import type { FeatureDiscovery } from '@/types';

interface UseFeatureViewsFetchReturn {
  features: FeatureDiscovery[];
  totalPages: number;
  loading: boolean;
  error: string | null;
  fetchFeatures: () => Promise<void>;
}

export const useFeatureViewsFetch = (
  search: string,
  entityId: string,
  page: number,
  onError: (message: string) => void
): UseFeatureViewsFetchReturn => {
  const [features, setFeatures] = useState<FeatureDiscovery[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeatures = useCallback(async () => {
    if (!entityId) {
      setFeatures([]);
      setTotalPages(1);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await viewsApi.listAvailableFeatures(search || undefined, entityId, page);
      setFeatures(res.data.items);
      setTotalPages(res.data.pagination.total_pages);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Hệ thống hiện không phản hồi. Vui lòng thử lại sau.';
      setError(message);
      onError(message);
    } finally {
      setLoading(false);
    }
  }, [search, entityId, page, onError]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  return { features, totalPages, loading, error, fetchFeatures };
};
