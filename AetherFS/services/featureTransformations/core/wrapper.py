# Standard Libraries
import logging

# User define Libraries
from common.constants import UDFConstants


# Logs
logger = logging.getLogger(__name__)


class UDFWrapper:
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