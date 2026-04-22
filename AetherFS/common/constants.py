# Standard Libraries
from enum import Enum
from dataclasses import dataclass, field

# Local Libraries
from services.transformations.core.system import SystemUtils


systemProfile = SystemUtils.get_profile()


class SourceType(str, Enum):
    BATCH = "BATCH"
    STREAM = "STREAM"


class SourceFormat(str, Enum):
    CSV = "CSV"
    PARQUET = "PARQUET"
    AVRO = "AVRO"
    JSON = "JSON"
    IMAGE = "IMAGE"
    TEXT = "TEXT"
    AUDIO = "AUDIO"
    VIDEO = "VIDEO"
    BINARY = "BINARY"


class ReadPolicies(str, Enum):
    FULL_READ = "FULL_READ"
    NEW_VALUES = "NEW_VALUES"


class TransformationType(str, Enum):
    SQL = "SQL"
    PYTHON_UDF = "PYTHON_UDF"
    AGGREGATION = "AGGREGATION"


class FeatureGroupStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    DEPRECATED = "DEPRECATED"


class VirtualTable(str, Enum):
    SOURCE_DATA = "source_data"


class Materialization(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELED = "CANCELED"


@dataclass
class DuckDBConfig:
    MEMORY_LIMIT: str = field(default=f"{int((systemProfile.total_ram_bytes * 0.5) / (1024 ** 3))}GB")
    THREADS: int = field(default=max(1, int(systemProfile.logical_cpus * 0.7)))


class PartitionFlavor(str, Enum):
    HIVE = "hive"
    DIRECTORY = "directory"


@dataclass
class RayConfig:
    NUM_CPUS: int = field(default=max(1, int(systemProfile.logical_cpus * 0.8)))
    NUM_GPUS: int = field(default=systemProfile.physical_gpus)
    MEMORY_BYTES: int = field(default=int(systemProfile.total_ram_bytes * 0.3))

    RUNTIME_ENV_KEY: str = "runtime_env"
    PIP_KEY: str = "pip"


class VirtualDataset(str, Enum):
    DEFAULT_STRUCTURED = "STRUCTURED"
    DEFAULT_UNSTRUCTURED = "UNSTRUCTURED"


class UDFConstants:
    DEFAULT_CLASS_NAME = "UDFProcessor"
    REQUIRED_METHOD = "__call__"
    REQUIRED_INIT_PARAM = "dataset_name"


class DatasetConfig:
    SINGLE_FILE_COUNT = 1
    HEAD_INDEX = 0
    NULL_VALUE = "null"
    TIME_TO_LIVE = 7 * 24 * 60 * 60 # Set TTL to 7 days


class ScheduleInterval(str, Enum):
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "1_week"
    MONTHLY = "1_month"
    QUARTERLY = "3_months"
