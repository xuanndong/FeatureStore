# Standard Libraries
import json
import logging
import itertools
import time

# Third party Libraries
from confluent_kafka import Consumer, KafkaException
import pyarrow as pa
from common.constants import SourceFormat
from services.transformations.core.storage import FsspecClient

# Logs
logger = logging.getLogger(__name__)


class StreamReader:
    def __init__(self, connection_options: dict | None = None, source_format=None):
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

        self.auto_offset_reset = self.opts.get("auto_offset_reset", "earliest")
        self.source_format = source_format

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

    def consume_micro_batches(self, topic: str, batch_size: int = 1000, timeout_sec: float = 1.0, stop_event=None):
        """
        Yields a PyArrow Table via micro-batching
        """
        consumer = Consumer({
            'bootstrap.servers': self.bootstrap_servers,
            'group.id': self.group_id,
            'auto.offset.reset': self.auto_offset_reset,
            'enable.auto.commit': False
        })

        consumer.subscribe([topic])
        logger.info("Initiate streaming from the Topic: '%s' (Group: %s)", topic, self.group_id)

        try:
            while True:
                if stop_event and stop_event.is_set():
                    break
                batch_data = []
                start_time = time.time()
                
                while len(batch_data) < batch_size:
                    elapsed = time.time() - start_time
                    remaining_timeout = max(0, timeout_sec - elapsed)
                    
                    if remaining_timeout == 0 and len(batch_data) > 0:
                        break
                        
                    msg = consumer.poll(timeout=remaining_timeout if remaining_timeout > 0 else timeout_sec)
                    
                    if msg is None:
                        break
                    if msg.error():
                        logger.warning("Kafka consumer error: %s", msg.error())
                        continue

                    record = self._parse_message(msg.value())
                    if record is not None:
                        batch_data.append(record)
                
                if not batch_data:
                    continue

                all_keys = {key for item in batch_data for key in item.keys()}
                columns = {key: [item.get(key) for item in batch_data] for key in all_keys}

                if self.source_format in [SourceFormat.IMAGE, SourceFormat.TEXT, SourceFormat.BINARY] and "path" in columns:
                    if self.source_format == SourceFormat.IMAGE:
                        import cv2
                        import numpy as np
                        images = []
                        for path in columns["path"]:
                            try:
                                client = FsspecClient(path, self.opts.get('storage_options'))
                                fs = client.get_raw_fs()
                                with fs.open(path, 'rb') as f:
                                    file_bytes = f.read()
                                    nparr = np.frombuffer(file_bytes, np.uint8)
                                    img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                                    images.append(img_np)
                            except Exception as e:
                                logger.error("Failed to read image %s: %s", path, e)
                                images.append(None)
                        columns["image"] = images
                        yield columns

                    elif self.source_format == SourceFormat.TEXT:
                        texts = []
                        for path in columns["path"]:
                            try:
                                client = FsspecClient(path, self.opts.get('storage_options'))
                                fs = client.get_raw_fs()
                                with fs.open(path, 'rb') as f:
                                    texts.append(f.read().decode('utf-8'))
                            except Exception as e:
                                logger.error("Failed to read text %s: %s", path, e)
                                texts.append(None)
                        columns["text"] = texts
                        yield columns

                    elif self.source_format == SourceFormat.BINARY:
                        binaries = []
                        for path in columns["path"]:
                            try:
                                client = FsspecClient(path, self.opts.get('storage_options'))
                                fs = client.get_raw_fs()
                                with fs.open(path, 'rb') as f:
                                    binaries.append(f.read())
                            except Exception as e:
                                logger.error("Failed to read binary %s: %s", path, e)
                                binaries.append(None)
                        columns["bytes"] = binaries
                        yield columns
                else:
                    yield pa.Table.from_pydict(columns)
                
                consumer.commit(asynchronous=False)
                
        except Exception as e:
            logger.error("Critical error in the streaming flow: %s", e)
            raise
        finally:
            consumer.close()
            logger.info("Kafka consumer connection closed safely")
