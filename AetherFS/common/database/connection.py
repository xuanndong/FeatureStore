# Standard Libraries
import logging
from collections.abc import AsyncGenerator

# Third party Libraries
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

# Local Libraries
from common.config import settings


# Logs
logger = logging.getLogger(__name__)


# Init async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo = False,
    future = True,
    pool_size = 20,
    max_overflow = 10
)

# Init session maker
async_session_maker = async_sessionmaker(
    bind = engine,
    class_ = AsyncSession,
    expire_on_commit = False,
    autocommit = False,
    autoflush = False,
)

# Dependency
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Create and manage the database session lifecycle for each HTTP request
    """
    async with async_session_maker() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session rollback due to error: {e}")
            raise
