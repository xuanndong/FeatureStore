# Standard Libraries
import logging

# Third party Libraries
import pyarrow as pa

# User define Libraries
from common.constants import UDFConstants


# Logs
logger = logging.getLogger(__name__)


class UDFEngine:
    """
    A dynamic engine that compiles and executes User-Defined Function (UDF) classes from source code strings
    """
    def __init__(self, udf_code: str, class_name: str, dataset_name: str):
        namespace = {}

        try:
            exec(udf_code, namespace)
        except SyntaxError as e:
            raise RuntimeError(f"Syntax error: {e.lineno}")
        except Exception as e:
            raise RuntimeError(f"Compile error: {e}")

        if class_name not in namespace:
            raise ValueError(f"The code must contain a class named: {class_name}")

        udf_class = namespace[class_name]

        if not hasattr(udf_class, UDFConstants.REQUIRED_METHOD):
            raise ValueError(f"Class '{class_name}' must implement '{UDFConstants.REQUIRED_METHOD}(self, batch)'")

        try:
            self.udf_instance = udf_class(dataset_name=dataset_name)
        except Exception as e:
            logger.error("Error during UDF dummy initialization: %s", e)
            raise ValueError(f"Error initializing class '{class_name}': {e}")

    def __call__(self, batch):
        return self.udf_instance(batch)


class RedisIngestion:
    """
    A distributed ingestor that pushes data directly from worker nodes to Redis, preventing memory overhead on the driver node
    """
    def __init__(self, feature_group: str, entity_keys: list[str], time_to_live: int):
        from services.featureTransformations.materializers.onlineStore import OnlineStore

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
