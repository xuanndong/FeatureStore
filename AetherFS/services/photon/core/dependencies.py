# Third party Libraries
from fastapi import Header, HTTPException, status, Query, Request
import redis.asyncio as aioredis


async def verify_api_version(x_api_version: str = Header(default="v1.0.0")):
    """
    Check version of API
    """
    allowed_versions = ["v1.0.0"]
    if x_api_version not in allowed_versions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported API Version: {x_api_version}. Allowed: {', '.join(allowed_versions)}"
        )

    return x_api_version


async def get_redis(request: Request) -> aioredis.Redis:
    """
    Get redis from app
    """
    return request.app.state.redis


class PaginationParams:
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Current page number (starts from 1)"),
        page_size: int = Query(5, ge=1, le=100, description="Number of records per page")
    ):
        self.page = page
        self.page_size = page_size
        self.offset = (page - 1) * page_size
        self.limit = page_size

    def get_metadata(self, total_items: int) -> dict:
        import math

        return {
            "current_page": self.page,
            "page_size": self.page_size,
            "total_items": total_items,
            "total pages": math.ceil(total_items / self.page_size)
        }
