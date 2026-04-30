# Standard Libraries
from uuid import UUID

# Third party Libraries
from pydantic import BaseModel, Field, ConfigDict

# Local Libraries
from common.constants import SourceFormat, SourceType


# Entity schemas
class EntityCreate(BaseModel):
    name: str = Field(..., max_length=100, description="Entity name (eg: user, transaction)")
    join_key: str = Field(..., max_length=50, description="Link lock (eg: user_id)")
    description: str | None = None


class EntityRead(BaseModel):
    id: UUID
    name: str
    join_key: str
    description: str | None
    updated_at: float | None
    created_at: float | None

    model_config = ConfigDict(from_attributes=True)


class EntityUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = None


# Data source schemas
class DataSourceCreate(BaseModel):
    name: str = Field(..., max_length=100, description="Data source name")
    source_type: SourceType
    source_format: SourceFormat
    location_uri: str = Field(..., max_length=255)
    connection_options: dict | None = None


class DataSourceRead(BaseModel):
    id: UUID
    name: str
    source_type: SourceType
    source_format: SourceFormat
    location_uri: str
    connection_status: bool
    updated_at: float
    created_at: float

    model_config = ConfigDict(from_attributes=True)


class DataSourceUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    connection_options: dict | None = None


class ConnectionTestRequest(BaseModel):
    location_uri: str = Field(..., description="Data path (e.g., /data/ or s3://my-bucket/)")
    connection_options: dict | None = Field(default=None, description="Connection parameters (e.g., access_key, secret_key, endpoint_url...)")


class OptionRead(BaseModel):
    id: UUID
    name: str


class EntityOption(OptionRead):
    join_key: str
