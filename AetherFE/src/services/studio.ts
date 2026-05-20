import { apiClient } from '@/services/api';
import type {
  StandardResponse, PaginatedResponse, FeatureGroup, FeatureGroupDetail, FeatureGroupCreate,
  FeatureGroupUpdate, PreviewRunRequest, TransformationPreview, StreamingConnectionData
} from '@/types';

export const studioApi = {
  listFeatureGroups: (search?: string, execution_status?: string, page = 1, limit = 10): Promise<StandardResponse<PaginatedResponse<FeatureGroup>>> => {
    return apiClient.get('/studio/feature-groups', { params: { search, execution_status, page, page_size: limit } });
  },
  getFeatureGroup: (id: string): Promise<StandardResponse<FeatureGroupDetail>> => {
    return apiClient.get(`/studio/feature-groups/${id}`);
  },
  createFeatureGroup: (payload: FeatureGroupCreate): Promise<StandardResponse<{ feature_group_id: string }>> => {
    return apiClient.post('/studio/feature-groups', payload);
  },
  updateFeatureGroup: (id: string, payload: FeatureGroupUpdate): Promise<StandardResponse<FeatureGroup>> => {
    return apiClient.patch(`/studio/feature-groups/${id}`, payload);
  },
  previewTransformation: (payload: PreviewRunRequest): Promise<StandardResponse<TransformationPreview>> => {
    return apiClient.post('/studio/preview', payload);
  },
  enableStreaming: (id: string): Promise<StandardResponse<StreamingConnectionData>> => {
    return apiClient.post(`/studio/feature-groups/${id}/streaming`);
  },
  disableStreaming: (id: string): Promise<StandardResponse<void>> => {
    return apiClient.delete(`/studio/feature-groups/${id}/streaming`);
  }
};
