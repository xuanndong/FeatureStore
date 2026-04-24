import { apiClient } from '@/services/api';
import type { StandardResponse, OnlineQueryRequest } from '@/types';

export const servingApi = {
  checkRedisStatus: (): Promise<StandardResponse<{ status: string; latency_ms: number }>> => {
    return apiClient.get('/online-store/status');
  },
  fetchOnlineFeatures: (payload: OnlineQueryRequest): Promise<StandardResponse<any>> => {
    return apiClient.post('/online-store/features/fetch', payload);
  }
};
