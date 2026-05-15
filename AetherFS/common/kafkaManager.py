# Standard Libraries
import logging

# Third party Libraries
from confluent_kafka.admin import AdminClient, NewTopic
from confluent_kafka import KafkaException

# Local Libraries
from common.config import settings


# Logs
logger = logging.getLogger(__name__)

class KafkaManagementService:
    def __init__(self, bootstrap_servers: str):
        # Init AdminClient from confluent-kafka
        self.admin_client = AdminClient({
            'bootstrap.servers': bootstrap_servers
        })

    def create_feature_topic(self, topic_name: str, num_partitions: int = 1, replication_factor: int = 1) -> bool:
        """
        Create new topic
        """
        new_topics = [
            NewTopic(
                topic=topic_name, 
                num_partitions=num_partitions, 
                replication_factor=replication_factor
            )
        ]

        fs = self.admin_client.create_topics(new_topics)

        for topic, future in fs.items():
            try:
                future.result() # Block until the topic is created or fails
                logger.info(f"Successfully created Kafka topic: {topic}")
                return True
            except KafkaException as e:
                if e.args[0].name() == "TOPIC_ALREADY_EXISTS":
                    logger.warning(f"Topic '{topic}' already exists")
                    return True
                else:
                    logger.error(f"Error while creating topic '{topic}': {e}")
                    raise Exception(f"Cannot initialize streaming flow: {e}")
            except Exception as e:
                logger.error(f"Unknown error occurred while creating topic '{topic}': {e}")
                raise Exception(f"System error: {e}")

    def delete_feature_topic(self, topic_name: str) -> bool:
        """
        Delete a kafka topic
        """
        fs = self.admin_client.delete_topics([topic_name])

        for topic, future in fs.items():
            try:
                future.result()
                logger.info(f"Successfully deleted Kafka topic: {topic}")
                return True
            except KafkaException as e:
                if e.args[0].name() == "UNKNOWN_TOPIC_OR_PART":
                    logger.warning(f"Kafka topic '{topic}' does not exist to delete")
                    return True
                else:
                    logger.error(f"Error while deleting topic '{topic}': {e}")
                    raise Exception(f"Failed to revoke streaming flow: {e}")
            except Exception as e:
                logger.error(f"Unknown error occurred while creating topic '{topic}': {e}")
                raise Exception(f"System error: {e}")


kafka_service = KafkaManagementService(bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS)
