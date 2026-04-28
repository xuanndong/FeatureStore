# Standard Libraries
from contextlib import asynccontextmanager
import logging

# Third party Libraries
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as aioredis

# Local Libraries
from common.config import settings
from services.photon.routers import view, registry, serving, studio, datasets

# Logs
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Connecting to Redis cluster...")
    redis = aioredis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        max_connections=10,
        socket_timeout=5.0
    )

    try:
        await redis.ping()
    except aioredis.ConnectionError:
        raise

    app.state.redis = redis
    yield
    await app.state.redis.close()


# Init FastAPI app
app = FastAPI(
    title="Aether Platform API - Photon Service",
    description="Core API for Feature Store Management and Serving",
    version="1.0.0",
    lifespan=lifespan
)


app.add_middleware(
    CORSMiddleware,
    allow_origins = ["*"],
    allow_credentials = True,
    allow_methods = ["*"],
    allow_headers =  ["*"]
)


app.include_router(view.router)
app.include_router(studio.router)
app.include_router(serving.router)
app.include_router(registry.router)
app.include_router(datasets.router)


@app.get("/", tags=["Health Check"])
async def root():
    """
    Check status
    """
    return {
        "service": "Aether Photon", 
        "status": "Online", 
        "version": "1.0.0"
    }


if __name__ == "__main__":
    uvicorn.run("services.photon.main:app", host="0.0.0.0", port=3000, reload=True)
