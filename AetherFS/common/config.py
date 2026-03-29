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
    MINIO_ENDPOINT: str = os.getenv("FEATURE_STORE_MINIO_ENDPOINT", "http://127.0.0.1:9000")
    MINIO_ACCESS_KEY: str = os.getenv("FEATURE_STORE_MINIO_ACCESS_KEY", "admin")
    MINIO_SECRET_KEY: str = os.getenv("FEATURE_STORE_MINIO_SECRET_KEY", "password123")
    
    # Ray Cluster
    RAY_CLUSTER_ADDRESS: str = os.getenv("RAY_CLUSTER_ADDRESS", "local")

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in ["production", "prod"]

settings = Settings()
