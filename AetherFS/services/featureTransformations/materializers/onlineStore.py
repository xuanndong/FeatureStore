# Standard Libraries
import json
import logging
import base64
from typing import Any

# Third party Libraries
import pyarrow as pa
import redis

# User define Libraries
from common.config import settings
from common.constants import DatasetConfig


# Logs
logger = logging.getLogger(__name__)


class OnlineStore:
    def __init__(self):
        self.redis_client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True
        )
        self.chunk_size = 1000

    @staticmethod
    def _serialize_value(value: Any) -> str:
        """
        Serialize data safely for Redis
        """
        if value is None:
            return DatasetConfig.NULL_VALUE

        if isinstance(value, bytes):
            return base64.b64encode(value).decode("utf-8")

        if isinstance(value, (dict, list)):
            return json.dumps(value)

        return str(value)

    @staticmethod
    def _deserialize_value(value: str) -> Any:
        """
        Deserialize data
        """
        if value == DatasetConfig.NULL_VALUE:
            return None

        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return value

    def _generate_key(self, project_id: str, feature_group: str, row_data: dict[str, Any], entity_keys: list[str]) -> str:
        """
        Generate key for Redis
        """
        key_parts = []
        for key in entity_keys:
            if key not in row_data:
                raise ValueError(f"Missing primary key in data record: '{key}'")
            key_parts.append(f"{key}:{row_data[key]}")

        entity_suffix = ":".join(key_parts)

        return f"fs:{project_id}:{feature_group}:{entity_suffix}"

    def upsert_pyarrow_table(self, table: pa.Table, project_id: str, feature_group: str, entity_keys: list[str]) -> int:
        """
        Write feature data from pyarrow tables to Redis
        """
        if not entity_keys:
            raise ValueError("'entity_keys' must be provided as the Redis primary key")
        
        feature_column_names = [col for col in table.column_names if col not in entity_keys]
        if not feature_column_names:
            logger.warning("[OnlineStore] No feature columns found to upsert")
            return 0

        pipeline = self.redis_client.pipeline()
        upsert_count = 0

        for batch in table.to_batches():
            records = batch.to_pylist()

            for row_data in records:
                try:
                    redis_key = self._generate_key(
                        project_id=project_id,
                        feature_group=feature_group,
                        row_data=row_data,
                        entity_keys=entity_keys
                    )

                    # dictionary comprehension
                    feature_payload = {
                        column_name: self._serialize_value(row_data[column_name]) 
                        for column_name in feature_column_names
                    }

                    if feature_payload:
                        pipeline.hset(redis_key, mapping=feature_payload)
                        upsert_count += 1

                        if upsert_count % self.chunk_size == 0:
                            pipeline.execute()
                except Exception as e:
                    logger.warning("[OnlineStore] Row skipped (Redis mapping failure): %s", e)

        try:
            pipeline.execute()
            logger.info("[OnlineStore] Successfully upserted %d records into %s: %s", upsert_count, project_id, feature_group)
            return upsert_count
        except Exception as e:
            logger.error("[OnlineStore] Failed to execute Redis pipeline: %s", e)
            raise RuntimeError(f"OnlineStore upsert error: {str(e)}")

    def get_features(self, project_id: str, feature_group: str, entity_keys_dict: dict[str, str]) -> dict[str, Any] | None:
        """
        Fetch features for an entity
        """
        key_parts = [f"{key}:{value}" for key, value in entity_keys_dict.items()]
        entity_suffix = ":".join(key_parts)
        redis_key = f"fs:{project_id}:{feature_group}:{entity_suffix}"

        raw_data = self.redis_client.hgetall(redis_key)

        if not raw_data:
            return None

        parsed_data = {
            column_name: self._deserialize_value(val)
            for column_name, val in raw_data.items()
        }

        return parsed_data
