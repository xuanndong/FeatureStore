import { apiClient } from '@/services/api';
import type { StandardResponse, OnlineQueryRequest, OnlineFeaturesResponse } from '@/types';

export const servingApi = {
  checkRedisStatus: (): Promise<StandardResponse<{ status: string; latency_ms: number }>> => {
    return apiClient.get('/online-store/status');
  },
  fetchOnlineFeatures: (payload: OnlineQueryRequest): Promise<StandardResponse<OnlineFeaturesResponse>> => {
    return apiClient.post('/online-store/features/fetch', payload);
  },
  getRedisKeys: (): Promise<StandardResponse<string[]>> => {
    return apiClient.get('/online-store/features/keys');
  },
  getRedisFeature: (key: string): Promise<StandardResponse<any>> => {
    return apiClient.get(`/online-store/features/get?key=${encodeURIComponent(key)}`);
  }
};
