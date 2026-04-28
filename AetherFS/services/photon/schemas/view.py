# Standard Libraries
from uuid import UUID

# Third party Libraries
from pydantic import BaseModel, Field, ConfigDict

class FeatureDiscoveryRead(BaseModel):
    id: UUID
    name: str
    data_type: str
    group_id: UUID
    group_name: str
    description: str | None
    
    entity_id: UUID
    entity_name: str

    model_config = ConfigDict(from_attributes=True)


class FeatureViewCreate(BaseModel):
    name: str = Field(..., max_length=100)
    ttl_seconds: int = Field(default=3600)
    entity_id: UUID = Field(..., description="ID of Entity")
    feature_ids: list[UUID] = Field(..., min_length=1)


class FeatureViewDetailRead(BaseModel):
    id: UUID
    name: str
    ttl_seconds: int
    entity_id: UUID
    created_at: float
    features: list[FeatureDiscoveryRead]


class FeatureViewListRead(BaseModel):
    id: UUID
    name: str
    ttl_seconds: int
    entity_id: UUID
    created_at: float
    feature_count: int

    model_config = ConfigDict(from_attributes=True)

class FeatureViewUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    ttl_seconds: int | None = None


class JobStatusPayload(BaseModel):
    job_id: str
    status: str
    message: str


class MaterializationRead(BaseModel):
    id: UUID
    feature_view_id: UUID
    status: str
    start_time: float | None = None
    end_time: float | None = None
    offline_uri: float | None = None
    error_message: float | None = None
    created_at: float
    updated_at: float

    model_config = ConfigDict(from_attributes=True)
