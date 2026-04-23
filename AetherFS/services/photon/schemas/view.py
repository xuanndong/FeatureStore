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

    model_config = ConfigDict(from_attributes=True)


class FeatureViewCreate(BaseModel):
    name: str = Field(..., max_length=100)
    ttl_seconds: int = Field(default=3600)
    feature_ids: list[UUID] = Field(..., min_length=1) # List of Selected Feature IDs


class FeatureViewDetailRead(BaseModel):
    id: UUID
    name: str
    ttl_seconds: str
    created_at: float
    features: list[FeatureDiscoveryRead]


class FeatureViewListRead(BaseModel):
    id: UUID
    name: str
    ttl_seconds: int
    created_at: float
    feature_count: int

    model_config = ConfigDict(from_attributes=True)


class FeatureViewUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    ttl_seconds: int | None = None
