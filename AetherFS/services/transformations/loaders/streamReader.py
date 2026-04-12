# Standard Libraries
import json
import logging
import asyncio
import itertools

# Third party Libraries
from aiokafka import AIOKafkaConsumer
import pyarrow as pa

# Logs
logger = logging.getLogger(__name__)


class StreamReader:
    def __init__(self, connection_options: dict | None = None):
        """
        Initialize the Kafka Consumer configuration
        """
        self.opts = connection_options or {}

        self.bootstrap_servers = self.opts.get("bootstrap_servers")
        if not self.bootstrap_servers:
            raise ValueError("Missing 'bootstrap_servers' configuration for Kafka Source")

        self.group_id = self.opts.get("group_id")
        if not self.group_id:
            raise ValueError("Missing 'group_id' configuration. Each Feature Pipeline must have a unique Group ID")

        self.auto_offset_reset = self.opts.get("auto_offset_reset", "latest")

    def _parse_message(self, value: bytes) -> dict | None:
        """
        Parses raw Kafka bytes into a dictionary
        """
        if not value:
            return None

        try:
            return json.loads(value)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None
        except Exception as e:
            logger.error("System error parsing message: %s", e)
            return None

    async def consume_micro_batches(self, topic: str, batch_size: int = 1000, timeout_sec: float = 1.0):
        """
        Yields a PyArrow Table via micro-batching
        """
        consumer = AIOKafkaConsumer(
            topic,
            bootstrap_servers=self.bootstrap_servers,
            group_id=self.group_id,
            auto_offset_reset=self.auto_offset_reset,
            enable_auto_commit=False
        )

        await consumer.start()
        logger.info("Initiate asynchronous streaming from the Topic: '%s' (Group: %s)", topic, self.group_id)

        try:
            while True:
                data = await consumer.getmany(
                    timeout_ms=int(timeout_sec * 1000),
                    max_records=batch_size
                )

                if not data:
                    continue

                all_messages = itertools.chain.from_iterable(data.values())
                batch_data = [
                    record for msg in all_messages
                    if (record := self._parse_message(msg.value)) is not None
                ]

                if not batch_data:
                    continue

                yield pa.Table.from_pylist(batch_data)

                await consumer.commit()
        except asyncio.CancelledError:
            logger.info("Streaming process was cancelled by the system")
        except Exception as e:
            logger.error("Critical error in the streaming flow: %s", e)
            raise
        finally:
            await consumer.stop()
            logger.info("Kafka consumer connection closed safely")
