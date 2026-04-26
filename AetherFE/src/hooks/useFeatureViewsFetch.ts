import { useState, useCallback, useEffect } from 'react';
import { viewsApi } from '@/services/views';
import type { FeatureDiscovery } from '@/types';

interface UseFeatureViewsFetchReturn {
  features: FeatureDiscovery[];
  loading: boolean;
  error: string | null;
  fetchFeatures: () => Promise<void>;
}

export const useFeatureViewsFetch = (
  search: string,
  onError: (message: string) => void
): UseFeatureViewsFetchReturn => {
  const [features, setFeatures] = useState<FeatureDiscovery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeatures = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await viewsApi.listAvailableFeatures(search || undefined);
      setFeatures(res.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Hệ thống hiện không phản hồi. Vui lòng thử lại sau.';
      setError(message);
      onError(message);
    } finally {
      setLoading(false);
    }
  }, [search, onError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFeatures();
  }, [fetchFeatures]);

  return { features, loading, error, fetchFeatures };
};
