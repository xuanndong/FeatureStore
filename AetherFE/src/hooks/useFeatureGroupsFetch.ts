import { useState, useCallback, useEffect } from 'react';
import { studioApi } from '@/services/studio';
import type { FeatureGroup } from '@/types';

export interface UseFeatureGroupsFetchReturn {
  data: FeatureGroup[];
  totalPages: number;
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
}

export const useFeatureGroupsFetch = (
  search: string,
  statusFilter: string,
  page: number,
  onError: (message: string) => void
): UseFeatureGroupsFetchReturn => {
  const [data, setData] = useState<FeatureGroup[]>([]);

  const [totalPages, setTotalPages] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await studioApi.listFeatureGroups(
        search || undefined,
        statusFilter || undefined,
        page,
        9
      );
      setData(res.data.items);

      const totalRecords = res.data.pagination?.total_pages ?? 0;
      setTotalPages(totalRecords);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Hệ thống hiện không phản hồi. Vui lòng thử lại sau.';
      setError(message);
      onError(message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page, onError]);

  // Initial load and re-fetch on dependency change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // WebSocket for real-time status updates
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/studio/ws/feature-groups';
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as {
          event: string;
          data: { id: string; status: FeatureGroup['last_run_status']; updated_at: number };
        };
        if (payload.event === 'FEATURE_GROUP_UPDATE' && payload.data) {
          setData(prev =>
            prev.map(fg =>
              fg.id === payload.data.id
                ? { ...fg, last_run_status: payload.data.status, updated_at: payload.data.updated_at }
                : fg
            )
          );
        }
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  return { data, totalPages, loading, error, fetchData };
};
