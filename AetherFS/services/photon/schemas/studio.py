# Standard Libraries
from uuid import UUID

# Third party Libraries
from pydantic import BaseModel, Field, model_validator, ConfigDict

# Local Libraries
from services.photon.schemas.registry import DataSourceCreate, EntityCreate
from common.constants import TransformationType, FeatureGroupStatus, Materialization, ScheduleInterval


class PreviewRunRequest(BaseModel):
    source_id: UUID | None = Field(default=None)
    new_source_config: DataSourceCreate | None = Field(default=None)

    transform_type: TransformationType
    transform_definition: str
    limit: int = Field(default=10, le=100)
    requirements: list[str] | None = None

    @model_validator(mode='after')
    def check_source_provided(self) -> 'PreviewRunRequest':
        if not self.source_id and not self.new_source_config:
            raise ValueError("Either 'source_id' or 'new_source_config' must be provided")
        if self.source_id and self.new_source_config:
            raise ValueError("Only one of 'source_id' or 'new_source_config' must be provided")
        return self


class FeatureCreate(BaseModel):
    name: str
    data_type: str


class FeatureGroupCreate(BaseModel):
    name: str = Field(..., max_length=100, description="Feature Group Name")

    # --- Entity ---
    entity_id: UUID | None = Field(default=None, description="Use existing Entity")
    new_entity_config: EntityCreate | None = Field(default=None, description="Create new Entity")

    # --- Data source ---
    source_id: UUID | None = Field(default=None, description="Use existing Data Source")
    new_source_config: DataSourceCreate | None = Field(default=None, description="Create new Data Source")

    # --- Transformation logic ---
    transformation_name: str = Field(..., max_length=100)
    transform_type: TransformationType
    transform_definition: str
    requirements: list[str] | None = None

    # List feature
    features: list[FeatureCreate] = Field(default_factory=list)

    # --- Scheduling ---
    is_scheduled: bool = Field(default=False)
    cron_expression: ScheduleInterval | None = None

    @model_validator(mode="after")
    def validate_wizard_steps(self) -> 'FeatureGroupCreate':
        # Validate entity
        if not self.entity_id and not self.new_entity_config:
            raise ValueError("Either 'entity_id' or 'new_entity_config' must be provided")
        if self.entity_id and self.new_entity_config:
            raise ValueError("Only one of 'entity_id' or 'new_entity_config' must be provided")

        # Validate data source
        if not self.source_id and not self.new_source_config:
            raise ValueError("Either 'source_id' or 'new_source_config' must be provided")
        if self.source_id and self.new_source_config:
            raise ValueError("Only one of 'source_id' or 'new_source_config' must be provided")

        # Validate scheduling
        if self.is_scheduled and not self.cron_expression:
            raise ValueError("'cron_expression' is required when scheduling is enabled")
            
        if not self.is_scheduled:
            self.cron_expression = None

        return self


class StatusPayload(BaseModel):
    feature_group_id: str
    status: str
    message: str


class FeatureGroupRead(BaseModel):
    id: UUID
    name: str
    status: FeatureGroupStatus
    last_run_status: Materialization

    is_scheduled: bool
    cron_expression: ScheduleInterval | None
    next_run_at: float | None

    updated_at: float | None
    created_at: float | None

    entity_id: UUID
    source_id: UUID
    transformation_id: UUID

    model_config = ConfigDict(from_attributes=True)


class FeatureGroupUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    status: FeatureGroupStatus | None = None
    is_scheduled: bool | None = None
    cron_expression: ScheduleInterval | None = None

    @model_validator(mode='after')
    def validate_schedule(self) -> 'FeatureGroupUpdate':
        # Enabling a schedule requires a cron expression
        if not self.is_scheduled and not self.cron_expression:
            raise ValueError("cron_expression' is required when 'is_scheduled' is enabled")

        if not self.is_scheduled:
            self.cron_expression = None

        return self
