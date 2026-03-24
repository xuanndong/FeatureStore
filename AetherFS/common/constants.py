# Standard Libraries
from enum import Enum
from dataclasses import dataclass


class SourceType(str, Enum):
    BATCH = "BATCH"
    STREAM = "STREAM"


class SourceFormat(str, Enum):
    CSV = "CSV"
    PARQUET = "PARQUET"
    AVRO = "AVRO"
    JSON = "JSON"


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


@dataclass
class DuckDBConfig:
    memory_limit: str = "4GB"
    threads: int = 4


class PartitionFlavor(str, Enum):
    HIVE = "hive"
    DIRECTORY = "directory"
