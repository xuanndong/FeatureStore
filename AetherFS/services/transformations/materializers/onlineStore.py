# Standard Libraries
import json
import logging
import base64
import datetime
import re
from typing import Any

# Third party Libraries
import pyarrow as pa
import redis
from redis.commands.json.path import Path

# Local Libraries
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
            return None

        if isinstance(value, bytes):
            return base64.b64encode(value).decode("utf-8")

        if isinstance(value, (datetime.datetime, datetime.date)):
            return value.isoformat()

        if isinstance(value, (dict, list)):
            return value

        return value

    @staticmethod
    def _deserialize_value(value: str) -> Any:
        """
        Deserialize data
        """
        if value is None or value == DatasetConfig.NULL_VALUE:
            return None

        return value

    def _generate_key(self, feature_group: str, row_data: dict[str, Any], entity_keys: list[str]) -> str:
        """
        Generate key for Redis
        """
        try:
            # Best Format: fs:<feature_group_name>:<join_key_1>:<value_1>
            clean_fg_name = re.sub(r'[^a-zA-Z0-9_-]', '_', feature_group).lower()
            entity_suffix = ":".join([f"{key}:{row_data[key]}" for key in entity_keys])
            return f"fs:{clean_fg_name}:{entity_suffix}"
        except KeyError as e:
            raise ValueError(f"Missing primary key in data record: {e}")

    def upsert_pyarrow_table(self, table: pa.Table, feature_group: str, entity_keys: list[str], time_to_live: int | None) -> int:
        """
        Write feature data from pyarrow tables to Redis
        """
        if not entity_keys:
            raise ValueError("'entity_keys' must be provided as the Redis primary key")
        
        feature_column_names = [col for col in table.column_names if col not in entity_keys]
        if not feature_column_names:
            logger.warning("[OnlineStore] No feature columns found to upsert")
            return 0

        time_to_live = time_to_live if time_to_live is not None else DatasetConfig.TIME_TO_LIVE

        pipeline = self.redis_client.pipeline()
        upsert_count = 0

        for batch in table.to_batches():
            records = batch.to_pylist()

            for row_data in records:
                try:
                    redis_key = self._generate_key(
                        feature_group=feature_group,
                        row_data=row_data,
                        entity_keys=entity_keys
                    )

                    # dictionary comprehension
                    feature_payload = {
                        column_name: self._serialize_value(row_data[column_name]) 
                        for column_name in feature_column_names
                    }

                    if not feature_payload: continue

                    pipeline.json().set(redis_key, Path.root_path(), feature_payload)

                    if time_to_live: pipeline.expire(redis_key, time_to_live)

                    upsert_count += 1

                    if upsert_count % self.chunk_size != 0: continue

                    pipeline.execute()
                except Exception as e:
                    logger.warning("[OnlineStore] Row skipped (Redis mapping failure): %s", e)

        try:
            if pipeline:
                pipeline.execute()
            logger.info("[OnlineStore] Successfully upserted %d JSON documents into: %s", upsert_count, feature_group)
            return upsert_count
        except Exception as e:
            logger.error("[OnlineStore] Failed to execute Redis pipeline: %s", e)
            raise RuntimeError(f"OnlineStore upsert error: {str(e)}")

    def get_features(self, feature_group: str, entity_keys_dict: dict[str, str]) -> dict[str, Any] | None:
        """
        Fetch features for an entity
        """
        key_parts = [f"{key}:{value}" for key, value in entity_keys_dict.items()]
        entity_suffix = ":".join(key_parts)
        clean_fg_name = re.sub(r'[^a-zA-Z0-9_-]', '_', feature_group).lower()
        redis_key = f"fs:{clean_fg_name}:{entity_suffix}"

        raw_data = self.redis_client.json().get(redis_key)

        if not raw_data:
            return None

        parsed_data = {
            column_name: self._deserialize_value(val)
            for column_name, val in raw_data.items()
        }

        return parsed_data
