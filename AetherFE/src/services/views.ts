import { apiClient } from '@/services/api';
import type { StandardResponse, FeatureDiscovery, FeatureViewCreate, FeatureView } from '@/types';

export const viewsApi = {
  listAvailableFeatures: (search?: string): Promise<StandardResponse<FeatureDiscovery[]>> => {
    return apiClient.get('/views/available-features', { params: { search } });
  },
  listFeatureViews: (search?: string): Promise<StandardResponse<any[]>> => {
    return apiClient.get('/views/feature-views', { params: { search } });
  },
  createFeatureView: (payload: FeatureViewCreate): Promise<StandardResponse<FeatureView>> => {
    return apiClient.post('/views/feature-views', payload);
  },
  getFeatureViewDetail: (id: string): Promise<StandardResponse<any>> => {
    return apiClient.get(`/views/feature-views/${id}`);
  }
};
