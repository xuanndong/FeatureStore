import { apiClient } from '@/services/api';
import type { 
  StandardResponse, 
  FeatureDiscovery, 
  FeatureViewCreate, 
  FeatureView,
  FeatureViewUpdate
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
  listAvailableFeatures: (search?: string, entityId?: string): Promise<StandardResponse<FeatureDiscovery[]>> => {
    return apiClient.get('/views/available-features', { 
      params: { 
        search, 
        entity_id: entityId
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
  }
};