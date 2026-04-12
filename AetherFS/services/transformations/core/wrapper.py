# Standard Libraries
import logging

# Third party Libraries
import pyarrow as pa

# User define Libraries
from common.constants import UDFConstants
from services.transformations.core.storage import FsspecClient


# Logs
logger = logging.getLogger(__name__)


class UDFEngine:
    """
    A dynamic engine that compiles and executes User-Defined Function (UDF) classes from source code strings
    """
    def __init__(self, udf_code: str, class_name: str, dataset_name: str, connection_options: dict | None = None):
        self.dataset_name = dataset_name
        self.connection_options = connection_options
        self.udf_instance = None

        namespace = {}

        try:
            exec(udf_code, namespace)
        except SyntaxError as e:
            logger.error("Syntax error in UDF: line %s", e.lineno)
            raise RuntimeError(f"Syntax error at line {e.lineno}")
        except Exception as e:
            logger.error("Compile error in UDF: %s", e)
            raise RuntimeError(f"Compile error: {e}")

        self.udf_class = namespace.get(class_name)
        if not self.udf_class:
            raise ValueError(f"The code must contain a class named: '{class_name}'")

        if not hasattr(self.udf_class, UDFConstants.REQUIRED_METHOD):
            raise ValueError(f"Class '{class_name}' must implement '{UDFConstants.REQUIRED_METHOD}(self, batch)'")

    def __call__(self, batch):
        if self.udf_instance is None:
            init_kwargs = {"dataset_name": self.dataset_name}
            first_path = None

            # Extract first path from the batch
            try:
                if isinstance(batch, dict) and "path" in batch and len(batch["path"]) > 0:
                    first_path = str(batch["path"][0])
            except Exception as e:
                logger.error("Failed to extract 'path' from batch: %s", e)

            # Prepare FileSystem if path exists
            if first_path:
                fs_client = FsspecClient(first_path, self.connection_options)
                init_kwargs["fs"] = fs_client.get_raw_fs()

            # EAFP Initialization
            try:
                self.udf_instance = self.udf_class(**init_kwargs)
            except TypeError as e:
                if "fs" in init_kwargs and "fs" in str(e):
                    logger.info("UDF '%s' does not accept 'fs'. Re-initializing without it.", self.udf_class.__name__)
                    init_kwargs.pop("fs")
                    self.udf_instance = self.udf_class(**init_kwargs)
                else:
                    raise ValueError(f"Error initializing class '{self.udf_class.__name__}': {e}")
            except Exception as e:
                logger.error("Failed to initialize user UDF class: %s", e)
                raise ValueError(f"Error initializing class '{self.udf_class.__name__}': {e}")

        # Execute Transformation
        return self.udf_instance(batch)


class RedisIngestion:
    """
    A distributed ingestor that pushes data directly from worker nodes to Redis, preventing memory overhead on the driver node
    """
    def __init__(self, feature_group: str, entity_keys: list[str], time_to_live: int):
        from services.transformations.materializers.onlineStore import OnlineStore

        self.online_store = OnlineStore()
        self.feature_group = feature_group
        self.entity_keys = entity_keys
        self.time_to_live = time_to_live

    def __call__(self, batch: pa.Table) -> pa.Table:
        if not isinstance(batch, pa.Table):
            try:
                batch = pa.Table.from_pandas(batch)
            except Exception as e:
                logger.warning(f"[RedisIngestor] Failed to convert batch to PyArrow: {e}")
                return batch # Bypass conversion to prevent pipeline failure

        self.online_store.upsert_pyarrow_table(
            table=batch,
            feature_group=self.feature_group,
            entity_keys=self.entity_keys,
            time_to_live=self.time_to_live
        )

        return batch
