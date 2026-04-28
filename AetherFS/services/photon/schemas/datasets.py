# Third party Libraries
from pydantic import BaseModel, Field
from typing import Any

# Local Libraries
from common.constants import DatasetsType


class RunScriptPayload(BaseModel):
    """
    Payload cho yêu cầu thực thi mã động
    """
    dataset_id: str = Field(..., description="ID of Feature Group or View")
    dataset_type: DatasetsType = Field(..., description="GROUP or VIEW")
    code: str = Field(..., description="Python source code to execute")
    requirements: list[str] = Field(default_factory=list, description="Required pip libraries")


class DatasetItem(BaseModel):
    dataset_id: str
    name: str
    dataset_type: str
    created_at: float


class DatasetAccessInfoData(BaseModel):
    dataset_id: str
    dataset_type: str
    access_url: str = Field(..., description="Pre-signed URL from MinIO")
    data_format: str = Field("Apache Parquet", description="Format")
    expires_at: float = Field(..., description="Expires Time")


class ScriptExecutionData(BaseModel):
    logs: str = Field(..., description="Console logs")
    analytics: dict[str, Any] = Field(default_factory=dict, description="Analytics")
