export type FeatureGroupStatus = 'ACTIVE' | 'INACTIVE' | 'DEPRECATED';
export type Materialization = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
export type ScheduleInterval = 'hourly' | 'daily' | '1_week' | '1_month' | '3_months';
export type TransformationType = 'SQL' | 'PYTHON_UDF' | 'AGGREGATION';
export type SourceType = 'BATCH' | 'STREAM';
export type SourceFormat = 'CSV' | 'PARQUET' | 'AVRO' | 'JSON' | 'IMAGE' | 'TEXT' | 'AUDIO' | 'VIDEO' | 'BINARY';

// --- Pagination ---
export interface PaginationMeta {
  current_page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

// --- Standard API Response ---
export interface StandardResponse<T> {
  detail?: string;
  data: T;
}

// --- Entity ---
export interface EntityOption { id: string; name: string; }
export interface Entity {
  id: string; name: string; join_key: string;
  description: string | null; updated_at: number; created_at: number;
}
export interface EntityCreate { name: string; join_key: string; description?: string; }

// --- Data Source ---
export interface DataSourceOption { id: string; name: string; }
export interface DataSource {
  id: string; name: string;
  source_type: SourceType; source_format: SourceFormat;
  location_uri: string; connection_status: boolean;
  updated_at: number; created_at: number;
}
export interface DataSourceCreate {
  name: string;
  source_type: SourceType;
  source_format: SourceFormat;
  location_uri: string;
  connection_options?: Record<string, string> | null;
}
export interface ConnectionTestRequest {
  location_uri: string; connection_options?: Record<string, string> | null;
}

// --- Feature Group ---
export interface FeatureGroup {
  id: string;
  name: string;
  version: number;
  status: FeatureGroupStatus;
  offline_uri: string | null;
  last_run_status: Materialization;

  is_scheduled: boolean;
  cron_expression: ScheduleInterval | null;
  next_run_at: number | null;

  updated_at: number;
  created_at: number;

  entity_id: string;
  source_id: string;
  transformation_id: string | null;

  transformation?: Transformation | null;
}


export interface FeatureGroupUpdate {
  name?: string; 
  status?: FeatureGroupStatus;
  is_scheduled?: boolean;
  cron_expression?: ScheduleInterval;
}


// Feature
export interface Feature {
  id: string;
  name: string;
  data_type: string;
  group_id: string;
}


// --- Wizard payloads ---
export interface WizardEntityStep {
  entity_id?: string;
  new_entity_config?: EntityCreate;
}
export interface WizardSourceStep {
  source_id?: string;
  new_source_config?: DataSourceCreate;
  connectionChecked?: boolean;
}
export interface WizardTransformStep {
  transformation_name: string;
  transform_type: TransformationType;
  transform_definition: string;
  requirements?: string[];
  previewOk?: boolean;
  inferredFeatures?: Array<{ name: string; data_type: string }>;
}
export interface FeatureGroupCreate {
  name: string;
  use_online_store: boolean;
  entity_id?: string;
  new_entity_config?: EntityCreate;
  source_id?: string;
  new_source_config?: DataSourceCreate;
  transformation_name: string;
  transform_type: TransformationType;
  transform_definition: string;
  requirements?: string[];
  features: Array<{ name: string; data_type: string }>;
  is_scheduled: boolean;
  cron_expression?: ScheduleInterval;
}

// --- Transformation ---
export interface Transformation {
  id: string;
  name: string;
  t_type: TransformationType;
  definition: string;
}

// --- Transformation Preview ---
export interface InferredFeature {
  name: string;
  data_type: string;
}

export interface TransformationPreview {
  preview_data: Record<string, unknown>[];
  inferred_features: InferredFeature[];
}

// --- Feature Views ---
export interface FeatureDiscovery {
  id: string; name: string; data_type: string; group_id: string; group_name: string;
}
export interface FeatureView {
  id: string; name: string; ttl_seconds: number; created_at: number;
}
export interface FeatureViewCreate { name: string; ttl_seconds: number; feature_ids: string[]; }

// --- Online serving ---
export interface OnlineQueryRequest { entity_name: string; record_id: string; }

export interface OnlineFeaturesResponse {
  [key: string]: string | number | boolean | null;
}

// --- Notification ---
export interface NotificationItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

// --- Preview ---
export interface PreviewRunRequest {
  source_id?: string;
  new_source_config?: DataSourceCreate;
  transform_type: TransformationType;
  transform_definition: string;
  limit?: number;
  requirements?: string[];
}
