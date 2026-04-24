import { apiClient } from '@/services/api';
import type {
  StandardResponse, PaginatedResponse, FeatureGroup, FeatureGroupCreate,
  FeatureGroupUpdate, PreviewRunRequest
} from '@/types';

export const studioApi = {
  listFeatureGroups: (search?: string, execution_status?: string, page = 1, limit = 10): Promise<StandardResponse<PaginatedResponse<FeatureGroup>>> => {
    return apiClient.get('/studio/feature-groups', { params: { search, execution_status, page, limit } });
  },
  createFeatureGroup: (payload: FeatureGroupCreate): Promise<StandardResponse<{ feature_group_id: string }>> => {
    return apiClient.post('/studio/feature-groups', payload);
  },
  updateFeatureGroup: (id: string, payload: FeatureGroupUpdate): Promise<StandardResponse<any>> => {
    return apiClient.patch(`/studio/feature-groups/${id}`, payload);
  },
  previewTransformation: (payload: PreviewRunRequest): Promise<StandardResponse<{ preview_data: any; inferred_features: any[] }>> => {
    return apiClient.post('/studio/preview', payload);
  }
};
