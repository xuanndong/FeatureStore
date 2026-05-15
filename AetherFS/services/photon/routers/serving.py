# Standard Libraries
from datetime import datetime, timezone

# Third party Libraries
from fastapi import APIRouter, Depends, HTTPException, status
import redis.asyncio as aioredis
import json

# Local Libraries
from services.photon.core.responses import StandardResponse
from services.photon.schemas.serving import OnlineQueryRequest
from services.photon.core.dependencies import verify_api_version, get_redis


router = APIRouter(prefix="/online-store", tags=["Online Serving"])


@router.get("/status", response_model=StandardResponse[dict])
async def check_redis_status(
    redis: aioredis.Redis = Depends(get_redis),
    version: str = Depends(verify_api_version)
):
    try:
        start_time = datetime.now(timezone.utc)
        await redis.ping()
        latency_ms = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000

        return StandardResponse(
            data={
                "status": "Connected",
                "latency_ms": round(latency_ms, 2)
            }
        )
    except Exception as e:
        return StandardResponse(
            detail=f"Redis cluster disconnected: {str(e)}",
            data={
                "status": "disconnected",
                "latency_ms": 0
            }
        )


@router.post("/features/fetch", response_model=StandardResponse[dict])
async def fetch_online_features(
    payload: OnlineQueryRequest,
    redis: aioredis.Redis = Depends(get_redis),
    version: str = Depends(verify_api_version)
):
    """
    Online feature extraction
    """
    redis_key = f"{payload.entity_name}:{payload.record_id}"

    try:
        feature_data = await redis.hgetall(redis_key)

        if not feature_data:
            return StandardResponse(
                detail=f"Online data not found for key: {redis_key}",
                data={
                    "key": redis_key,
                    "features": None
                }
            )

        return StandardResponse(
            detail="Online data retrieval successful",
            data={
                "key": redis_key,
                "features": feature_data
            }
        )
    except aioredis.RedisError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Redis retrieval error: {str(e)}"
        )


@router.get("/features/keys", response_model=StandardResponse[list[str]])
async def get_redis_keys(
    redis: aioredis.Redis = Depends(get_redis),
    version: str = Depends(verify_api_version)
):
    """
    Get all feature keys from Redis
    """
    try:
        keys = await redis.keys("fs:*")
        return StandardResponse(
            detail="Keys retrieved successfully",
            data=keys
        )
    except aioredis.RedisError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Redis retrieval error: {str(e)}"
        )

@router.get("/features/get", response_model=StandardResponse[dict])
async def get_redis_feature(
    key: str,
    redis: aioredis.Redis = Depends(get_redis),
    version: str = Depends(verify_api_version)
):
    """
    Get a specific feature as JSON
    """
    try:
        # Fetch raw JSON string from Redis ReJSON
        raw_data = await redis.execute_command("JSON.GET", key)
        if not raw_data:
            return StandardResponse(
                detail=f"Online data not found for key: {key}",
                data=None
            )
        
        parsed_data = json.loads(raw_data)
        return StandardResponse(
            detail="Online data retrieval successful",
            data=parsed_data
        )
    except aioredis.RedisError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Redis retrieval error: {str(e)}"
        )
