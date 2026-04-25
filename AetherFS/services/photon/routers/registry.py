# Standard Libraries
from uuid import UUID

# Third party Libraries
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

# Local Libraries
from common.database.models import Entity, DataSource
from services.photon.schemas.registry import EntityCreate, EntityRead, DataSourceCreate, DataSourceRead, EntityUpdate, DataSourceUpdate, ConnectionTestRequest, OptionRead
from services.photon.core.responses import StandardResponse
from services.photon.core.dependencies import verify_api_version, PaginationParams
from services.photon.core.utils import verify_connection
from common.database.connection import get_session


router = APIRouter(prefix="/registry", tags=["Infrastructure Registry"])


# --- Entity ---
@router.post("/entities", response_model=StandardResponse[EntityRead])
async def create_entity(
    payload: EntityCreate,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Create entity
    """
    # Entity name already exists
    existing = await db.execute(select(Entity).where(Entity.name == payload.name))
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Entity name already exists in the system"
        )

    new_entity = Entity(**payload.model_dump())
    db.add(new_entity)

    await db.commit()
    await db.refresh(new_entity)

    return StandardResponse(
        detail="Entity created successfully",
        data=new_entity
    )


@router.get("/entities", response_model=StandardResponse[dict])
async def list_entities(
    search: str | None = None,
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    List entities
    """
    query = select(Entity)
    if search:
        query = query.where(Entity.name.ilike(f"%{search}%") | Entity.join_key.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count(Entity.id)).select_from(Entity))).scalar() or 0

    result = await db.execute(
        query.order_by(Entity.created_at.desc()).offset(pagination.offset).limit(pagination.limit)
    )

    entities = result.scalars().all()

    return StandardResponse(
        data={
            "items": [EntityRead.model_validate(entity) for entity in entities],
            "pagination": pagination.get_metadata(total)
        }
    )


@router.get("/entities/options", response_model=StandardResponse[list[OptionRead]])
async def get_entity_options(
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Fetch lightweight entity list for UI dropdowns
    """
    result = await db.execute(select(Entity.id, Entity.name).order_by(Entity.name))
    options = [{"id": row.id, "name": row.name} for row in result.all()]

    return StandardResponse(data=options)


@router.patch("/entities/{id}", response_model=StandardResponse[EntityRead])
async def update_entity(
    id: UUID,
    payload: EntityUpdate,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Update entity
    """
    entity = await db.get(Entity, id)
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entity not found"
        )

    name_changed = payload.name and payload.name != entity.name
    is_duplicate = name_changed and await db.scalar(select(Entity.id).where(Entity.name == payload.name))

    if is_duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Entity name already exists in the system"
        )

    # Extract only the fields that were actually sent in the request
    update_data = payload.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(entity, key, value)

    await db.commit()
    await db.refresh(entity)

    return StandardResponse(
        detail="Entity updated successfully",
        data=entity
    )


@router.get("/entities/{id}", response_model=StandardResponse[EntityRead])
async def get_entity_detail(
    id: UUID,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Get entity detail
    """
    entity = await db.get(Entity, id)
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entity not found"
        )

    return StandardResponse(data=entity)


@router.delete("/entities/{id}", response_model=StandardResponse[None])
async def delete_entity(
    id: UUID,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    entity = await db.get(Entity, id)
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entity not found"
        )

    await db.delete(entity)
    await db.commit()

    return StandardResponse(
        detail="Entity deleted successfully"
    )


# --- Data source ---
@router.post("/data-sources", response_model=StandardResponse[DataSourceRead])
async def create_data_source(
    payload: DataSourceCreate,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Create data sources
    """
    existing = await db.execute(select(DataSource).where(DataSource.name == payload.name))
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Data source name already exists in the system"
        )

    # Check URI
    is_ok, message = await verify_connection(
        uri=payload.location_uri,
        options=payload.connection_options
    )

    if not is_ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot connect to the storage: {message}"
        )

    new_source = DataSource(
        **payload.model_dump(),
        connection_status=True
    )

    db.add(new_source)

    await db.commit()
    await db.refresh(new_source)

    return StandardResponse(
        detail="Data source created successfully",
        data=new_source
    )


@router.get("/data-sources", response_model=StandardResponse[dict])
async def list_data_sources(
    search: str | None = None,
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    List data sources
    """
    query = select(DataSource)
    if search:
        query = query.where(DataSource.name.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count(DataSource.id)).select_from(DataSource))).scalar() or 0

    result = await db.execute(
        query.order_by(DataSource.created_at.desc()).offset(pagination.offset).limit(pagination.limit)
    )

    sources = result.scalars().all()

    return StandardResponse(
        data={
            "items": [DataSourceRead.model_validate(source) for source in sources],
            "pagination": pagination.get_metadata(total)
        }
    )


@router.get("/data-sources/options", response_model=StandardResponse[list[OptionRead]])
async def get_data_source_options(
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Fetch lightweight data source list for UI dropdowns
    """
    result = await db.execute(select(DataSource.id, DataSource.name).order_by(DataSource.name))
    options = [{"id": row.id, "name": row.name} for row in result.all()]

    return StandardResponse(data=options)


@router.post("/data-sources/connection", response_model=StandardResponse[dict])
async def test_connection(
    payload: ConnectionTestRequest,
    version: str = Depends(verify_api_version)
):
    """
    Validate data source integrity
    """
    is_ok, message = await verify_connection(
        uri=payload.location_uri,
        options=payload.connection_options
    )

    if not is_ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    return StandardResponse(
        detail=message,
        data={"status": is_ok}
    )


@router.patch("/data-sources/{id}", response_model=StandardResponse[DataSourceRead])
async def update_data_source(
    id: UUID,
    payload: DataSourceUpdate,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Update data source
    """
    source = await db.get(DataSource, id)
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data source not found"
        )

    name_changed = payload.name and payload.name != source.name
    is_duplicate = name_changed and await db.scalar(select(DataSource.id).where(DataSource.name == payload.name))

    if is_duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Data source name already exists in the system"
        )

    # Extract only the fields that were actually sent in the request
    update_data = payload.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(source, key, value)

    await db.commit()
    await db.refresh(source)

    return StandardResponse(
        detail="Data source updated successfully",
        data=source
    )


@router.get("/data-sources/{id}", response_model=StandardResponse[DataSourceRead])
async def get_data_source_detail(
    id: UUID,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Get data source detail
    """
    source = await db.get(DataSource, id)
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data source not found"
        )

    return StandardResponse(data=source)


@router.delete("/data-sources/{id}", response_model=StandardResponse[None])
async def delete_data_source(
    id: UUID,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    source = await db.get(DataSource, id)
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data source not found"
        )

    await db.delete(source)
    await db.commit()

    return StandardResponse(
        detail="Data source deleted successfully"
    )
