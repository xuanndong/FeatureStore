import { apiClient } from '@/services/api';
import type {
  StandardResponse, PaginatedResponse, Entity, EntityCreate, EntityOption,
  DataSource, DataSourceCreate, DataSourceOption, ConnectionTestRequest
} from '@/types';

export const registryApi = {
  // --- Entities ---
  listEntities: (search?: string, page = 1, limit = 10): Promise<StandardResponse<PaginatedResponse<Entity>>> => {
    return apiClient.get('/registry/entities', { params: { search, page, page_size: limit } });
  },
  getEntityOptions: (): Promise<StandardResponse<EntityOption[]>> => {
    return apiClient.get('/registry/entities/options');
  },
  createEntity: (payload: EntityCreate): Promise<StandardResponse<Entity>> => {
    return apiClient.post('/registry/entities', payload);
  },

  // --- Data Sources ---
  listDataSources: (search?: string, page = 1, limit = 10): Promise<StandardResponse<PaginatedResponse<DataSource>>> => {
    return apiClient.get('/registry/data-sources', { params: { search, page, page_size: limit } });
  },
  getSourceOptions: (): Promise<StandardResponse<DataSourceOption[]>> => {
    return apiClient.get('/registry/data-sources/options');
  },
  createDataSource: (payload: DataSourceCreate): Promise<StandardResponse<DataSource>> => {
    return apiClient.post('/registry/data-sources', payload);
  },
  testConnection: (payload: ConnectionTestRequest): Promise<StandardResponse<string>> => {
    return apiClient.post('/registry/data-sources/connection', payload);
  }
};
