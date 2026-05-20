import { apiClient } from '@/services/api';
import type { 
  StandardResponse, 
  PaginatedResponse,
  DatasetItem,
  DatasetAccessInfoData,
  RunScriptPayload,
  ScriptExecutionData,
  DatasetType
} from '@/types';

export const datasetsApi = {
  // Get list dataset
  listReadyDatasets: (
    dataset_type?: DatasetType,
    search?: string,
    page = 1,
    limit = 10
  ): Promise<StandardResponse<PaginatedResponse<DatasetItem>>> => {
    return apiClient.get('/datasets', { params: { dataset_type, search, page, page_size: limit } });
  },

  // Get Pre-signed URL
  getAccessInfo: (
    dataset_id: string,
    dataset_type: string,
    expires_in = 3600
  ): Promise<StandardResponse<DatasetAccessInfoData>> => {
    return apiClient.get('/datasets/access-info', { params: { dataset_id, dataset_type, expires_in } });
  },

  // Execute script
  runExperiment: (
    payload: RunScriptPayload
  ): Promise<StandardResponse<ScriptExecutionData>> => {
    return apiClient.post('/datasets/experiments', payload);
  }
};
