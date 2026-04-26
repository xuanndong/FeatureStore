# Standard Libraries
import os
from dataclasses import dataclass
from dotenv import load_dotenv

# Loads env
load_dotenv()

@dataclass
class Settings:
    # App
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "Aether Feature Store")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Internal Storage (MinIO/S3)
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "http://127.0.0.1:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "admin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "password123")
    OFFLINE_STORE_URI: str = os.getenv("OFFLINE_STORE_URI", "s3://aether-offline-store")

    # Ray Cluster
    RAY_CLUSTER_ADDRESS: str = os.getenv("RAY_CLUSTER_ADDRESS", "local").lower()

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Worker
    AETHER_MAX_WORKERS: int = int(os.getenv("AETHER_MAX_WORKERS", 2))

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", None)

    # GRPC Server
    GRPC_SERVER_URL: str = os.getenv("GRPC_SERVER_URL", "localhost:50051")

    # Webhook
    WEBHOOK_URL: str = os.getenv("WEBHOOK_URL", "http://localhost:8000/api/v1/webhook/status")

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in ["production", "prod"]

settings = Settings()
