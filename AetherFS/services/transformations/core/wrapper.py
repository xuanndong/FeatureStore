# Standard Libraries
import logging
import ast
import inspect

# Third party Libraries
import pyarrow as pa
import pandas as pd
import numpy as np

# Local Libraries
from common.constants import UDFConstants
from services.transformations.core.storage import FsspecClient


# Logs
logger = logging.getLogger(__name__)


def find_udf_class_name(code_str: str) -> str | None:
    """
    Find class
    """
    try:
        tree = ast.parse(code_str)
        for node in tree.body:
            if not isinstance(node, ast.ClassDef):
                continue

            # Check __call__ method in class
            if any(isinstance(n, ast.FunctionDef) and n.name == "__call__" for n in node.body):
                return node.name
    except Exception:
        pass

    return None

class UDFEngine:
    """
    A dynamic engine that compiles and executes User-Defined Function (UDF) classes from source code strings
    """
    def __init__(self, udf_code: str, class_name: str, dataset_name: str, join_key: str = None, connection_options: dict | None = None):
        self.dataset_name = dataset_name
        self.connection_options = connection_options
        self.join_key = join_key
        self.udf_instance = None

        detected_name = find_udf_class_name(udf_code)
        self.target_class_name = detected_name or class_name

        namespace = {}

        try:
            exec(udf_code, namespace)
        except SyntaxError as e:
            logger.error("Syntax error in UDF: line %s", e.lineno)
            raise RuntimeError(f"Syntax error at line {e.lineno}")
        except Exception as e:
            logger.error("Compile error in UDF: %s", e)
            raise RuntimeError(f"Compile error: {e}")

        self.udf_class = namespace.get(self.target_class_name)
        if not self.udf_class:
            raise ValueError(f"Class '{self.target_class_name}' not found in code")

        if not hasattr(self.udf_class, UDFConstants.REQUIRED_METHOD):
            raise ValueError(f"Class '{self.target_class_name}' must implement '{UDFConstants.REQUIRED_METHOD}'")

    def _init_instance(self, batch):
        """
        Smart Init instance of UDF class using inspect
        """
        available_kwargs = {"dataset_name": self.dataset_name}

        first_path = None
        first_path = None
        if isinstance(batch, dict) and "path" in batch:
            paths = batch["path"]
            if len(paths) > 0:
                first_path = str(paths[0])

        if first_path:
            client = FsspecClient(first_path, self.connection_options)
            available_kwargs["fs"] = client.get_raw_fs()

        try:
            sig = inspect.signature(self.udf_class)
            params = sig.parameters
            accepts_kwargs = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values())

            if accepts_kwargs:
                final_kwargs = available_kwargs
            else:
                final_kwargs = {k: v for k, v in available_kwargs.items() if k in params}

            self.udf_instance = self.udf_class(**final_kwargs)

        except Exception as e:
            raise ValueError(f"Initialization error for class '{self.target_class_name}': {e}")

    def __call__(self, batch):
        if self.udf_instance is None:
            self._init_instance(batch)

            if self.udf_instance is None:
                raise RuntimeError(f"Could not initialize class '{self.target_class_name}'. Please check the UDF's __init__ method")

        if isinstance(batch, pa.Table):
            safe_batch = batch.to_pandas()
        elif isinstance(batch, dict):
            processed_dict = {}
            for key, value in batch.items():
                if isinstance(value, np.ndarray) and value.ndim > 1:
                    processed_dict[key] = [item for item in value]
                else:
                    processed_dict[key] = value
            safe_batch = pd.DataFrame(processed_dict)
        elif isinstance(batch, pd.DataFrame):
            safe_batch = batch
        else:
            safe_batch = batch

        # Execute Transformation
        try:
            method_name = UDFConstants.REQUIRED_METHOD
            method_to_call = getattr(self.udf_instance, method_name, None)

            if method_to_call is None or not callable(method_to_call):
                raise AttributeError(f"Class '{self.target_class_name}' is missing or has a corrupted '{method_name}()' method")

            result = self.udf_instance(safe_batch)

            if isinstance(result, list):
                return pd.DataFrame(result)

            return result
        except Exception as e:
            logger.error(f"UDF logic error '{self.target_class_name}': {str(e)}")
            raise RuntimeError(f"Error when executing code: {str(e)}") from e


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
