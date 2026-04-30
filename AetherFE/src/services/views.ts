import { apiClient } from '@/services/api';
import type { 
  StandardResponse, 
  FeatureDiscovery, 
  FeatureViewCreate, 
  FeatureView,
  FeatureViewUpdate,
  MaterializationJob
} from '@/types';

// Bạn có thể định nghĩa interface này ngay đây hoặc đưa vào file types.ts dùng chung
export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next?: boolean;
    has_previous?: boolean;
  };
}

export const viewsApi = {
  listAvailableFeatures: (search?: string, entityId?: string, page: number = 1, limit: number = 10): Promise<StandardResponse<PaginatedResult<FeatureDiscovery>>> => {
    return apiClient.get('/views/available-features', { 
      params: { 
        search, 
        entity_id: entityId,
        page,
        page_size: limit
      } 
    });
  },
  
  listFeatureViews: (search?: string, page: number = 1, limit: number = 10): Promise<StandardResponse<PaginatedResult<FeatureView>>> => {
    return apiClient.get('/views/feature-views', { 
      params: { search, page, limit } 
    });
  },
  
  createFeatureView: (payload: FeatureViewCreate): Promise<StandardResponse<FeatureView>> => {
    return apiClient.post('/views/feature-views', payload);
  },
  
  getFeatureViewDetail: (id: string): Promise<StandardResponse<FeatureView>> => {
    return apiClient.get(`/views/feature-views/${id}`);
  },

  updateFeatureView: (id: string, payload: FeatureViewUpdate): Promise<StandardResponse<FeatureView>> => {
    return apiClient.patch(`/views/feature-views/${id}`, payload);
  },

  deleteFeatureView: (id: string): Promise<StandardResponse<any>> => {
    return apiClient.delete(`/views/feature-views/${id}`);
  },

  listMaterializationJobs: (
    featureViewId?: string,
    executionStatus?: string,
    page: number = 1,
    limit: number = 10
  ): Promise<StandardResponse<PaginatedResult<MaterializationJob>>> => {
    return apiClient.get('/views/materialization-jobs', {
      params: {
        feature_view_id: featureViewId,
        execution_status: executionStatus,
        page,
        page_size: limit
      }
    });
  }
};