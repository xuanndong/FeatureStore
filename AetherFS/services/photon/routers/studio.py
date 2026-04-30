# Standard Libraries
import json
import uuid
from datetime import timezone, datetime

# Third party Libraries
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select, func
import grpc

# Local Libraries
from common.database.models import DataSource, FeatureGroup, Transformation, Entity, Feature
from common.database.connection import get_session
from common.grpc import featurePipeline_pb2 as pb2
from common.constants import Materialization, FeatureGroupStatus
from common.config import settings
from services.photon.schemas.studio import FeatureGroupCreate, PreviewRunRequest, StatusPayload, FeatureGroupRead, FeatureGroupUpdate, FeatureGroupDetail
from services.photon.core.responses import StandardResponse
from services.photon.core.dependencies import verify_api_version, PaginationParams
from services.photon.core.grpcClient import grpc_client
from services.photon.core.utils import infer_features_from_records, calculate_next_run, generate_strict_hash
from services.photon.core.websocket import manager


router = APIRouter(prefix="/studio", tags=["Transformation Studio"])


@router.post("/preview", response_model=StandardResponse[dict])
async def preview_transformation(
    payload: PreviewRunRequest,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Preview transformation & Infer Schema
    """
    location_uri = ""
    source_format = None
    connection_options_json = ""

    # User selects an existing data source
    if payload.source_id:
        source = await db.get(DataSource, payload.source_id)
        if not source:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Data source not found"
            )
        if not source.connection_status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This data source is currently disconnected"
            )

        location_uri = source.location_uri
        source_format = source.source_format
        connection_options_json = json.dumps(source.connection_options, default=str) if source.connection_options else ""

    # User has just created a new data source
    elif payload.new_source_config:
        cfg = payload.new_source_config
        location_uri = cfg.location_uri
        source_format = cfg.source_format
        connection_options_json = json.dumps(cfg.connection_options, default=str) if cfg.connection_options else ""

    # Mapping enum
    format_name = source_format.name if hasattr(source_format, 'name') else str(source_format).upper()
    transform_name = payload.transform_type.name if hasattr(payload.transform_type, 'name') else str(payload.transform_type).upper()

    proto_source_format = getattr(pb2.SourceFormat, format_name)
    proto_transform_type = getattr(pb2.TransformationType, transform_name)

    # gRPC request
    grpc_req = pb2.PreviewRequest(
        location_uri=location_uri,
        source_format=proto_source_format,
        transform_type=proto_transform_type,
        transform_definition=payload.transform_definition,
        connection_options_json=connection_options_json,
        limit=payload.limit,
    )

    if payload.requirements:
        clean_preview_reqs = [r.strip() for r in payload.requirements if r.strip()]
        grpc_req.requirements.extend(clean_preview_reqs)

    try:
        grpc_res = await grpc_client.get_preview(grpc_req)

        parsed_results = {}
        inferred_schema = []

        for ds_name, json_str in grpc_res.results_json.items():
            records = json.loads(json_str)
            parsed_results[ds_name] = records

            if not inferred_schema and records:
                inferred_schema = infer_features_from_records(records)

        return StandardResponse(
            detail="Preview generated successfully",
            data={
                "preview_data": parsed_results,      
                "inferred_features": inferred_schema 
            }
        )
    except grpc.aio.AioRpcError as rpc_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error executing code: {rpc_error.details()}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"System error: {str(e)}"
        )


@router.post("/feature-groups", response_model=StandardResponse[dict])
async def create_feature_group(
    payload: FeatureGroupCreate,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Create Feature Group along with Entity, DataSource, Transformation, and Features in a single transaction
    """
    base_uri = settings.OFFLINE_STORE_URI.rstrip('/')

    try:
        max_version = await db.scalar(
            select(func.max(FeatureGroup.version))
            .where(FeatureGroup.name == payload.name)
        )
        current_version = (max_version or 0) + 1

        final_entity_id = payload.entity_id
        final_source_id = payload.source_id

        join_key = None

        # Resolve entity
        if payload.new_entity_config:
            if await db.scalar(select(Entity.id).where(Entity.name == payload.new_entity_config.name)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Entity name '{payload.new_entity_config.name}' already exists"
                )

            new_entity = Entity(**payload.new_entity_config.model_dump())

            db.add(new_entity)
            await db.flush() # Generate ID without committing
            final_entity_id = new_entity.id
            join_key = new_entity.join_key
        else:
            existing_entity = await db.get(Entity, final_entity_id)
            if not existing_entity:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Entity not found"
                )
            join_key = existing_entity.join_key

        # Resolve data source
        location_uri = ""
        source_format = None
        connection_options_json = ""

        if payload.new_source_config:
            if await db.scalar(select(DataSource.id).where(DataSource.name == payload.new_source_config.name)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Data source name '{payload.new_source_config.name}' already exists"
                )

            # Setup default connection status
            new_source = DataSource(**payload.new_source_config.model_dump())

            db.add(new_source)
            await db.flush()

            final_source_id = new_source.id
            location_uri = new_source.location_uri
            source_format = new_source.source_format
            connection_options_json = json.dumps(new_source.connection_options, default=str) if new_source.connection_options else ""

        else:
            source = await db.get(DataSource, final_source_id)
            if not source:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Data source not found"
                )

            location_uri = source.location_uri
            source_format = source.source_format
            connection_options_json = json.dumps(source.connection_options, default=str) if source.connection_options else ""

        clean_reqs = sorted([r.strip() for r in (payload.requirements or []) if r.strip()])
        content_hash = generate_strict_hash(
            payload.transform_type.value, 
            payload.transform_definition, 
            payload.features,
            clean_reqs
        )

        existing_transform = await db.scalar(
            select(Transformation).where(Transformation.content_hash == content_hash)
        )

        if existing_transform:
            final_transform_id = existing_transform.id
        else:
            if await db.scalar(select(Transformation.id).where(Transformation.name == payload.transformation_name)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Transformation name '{payload.transformation_name}' already exists with different logic."
                )

            # Create transformation
            new_transform = Transformation(
                name=payload.transformation_name,
                t_type=payload.transform_type,
                definition=payload.transform_definition,
                requirements=clean_reqs,
                content_hash=content_hash
            )

            db.add(new_transform)
            await db.flush()

            final_transform_id = new_transform.id

        existing_pipeline = await db.scalar(
            select(FeatureGroup).where(
                FeatureGroup.name == payload.name,
                FeatureGroup.entity_id == final_entity_id,
                FeatureGroup.source_id == final_source_id,
                FeatureGroup.transformation_id == final_transform_id
            )
        )

        if existing_pipeline:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"This data is not new! It is identical to version v{existing_pipeline.version} of '{payload.name}'. Skipping re-run"
            )

        next_run_timestamp = None
        if payload.is_scheduled and payload.cron_expression:
            interval_value = payload.cron_expression.value if hasattr(payload.cron_expression, 'value') else payload.cron_expression
            next_run_timestamp = calculate_next_run(interval_value)

        # Create feature group
        new_fg_id = uuid.uuid4()
        output_uri = f"{base_uri}/feature_groups/{new_fg_id}"

        new_fg = FeatureGroup(
            id=new_fg_id,
            name=payload.name,
            version=current_version,
            offline_uri=output_uri,
            entity_id=final_entity_id,
            source_id=final_source_id,
            transformation_id=final_transform_id,
            is_scheduled=payload.is_scheduled,
            cron_expression=payload.cron_expression if payload.is_scheduled else None,
            next_run_at=next_run_timestamp
        )

        db.add(new_fg)
        await db.flush()

        # Resolve features
        if payload.features:
            for feat in payload.features:
                new_feature = Feature(
                    group_id=new_fg_id,
                    name=feat.name,
                    data_type=feat.data_type
                )
                db.add(new_feature)

        # Setup gRPC scheduling
        source_name = source_format.name if hasattr(source_format, 'name') else str(source_format).upper()
        transform_name = payload.transform_type.name if hasattr(payload.transform_type, 'name') else str(payload.transform_type).upper()

        proto_source_format = getattr(pb2.SourceFormat, source_name)
        proto_transform_type = getattr(pb2.TransformationType, transform_name)

        run_req = pb2.RunRequest(
            location_uri=location_uri,
            output_uri=output_uri,
            source_format=proto_source_format,
            transform_type=proto_transform_type,
            transform_definition=payload.transform_definition,
            connection_options_json=connection_options_json,
            feature_group_id=str(new_fg_id),
            webhook_url=settings.WEBHOOK_URL, # webhook url
            join_key=join_key
        )

        if clean_reqs:
            run_req.requirements.extend(clean_reqs)

        run_res = await grpc_client.run_pipeline(run_req)
        new_fg.last_run_status = run_res.status
        new_fg.updated_at = datetime.now(timezone.utc).timestamp()

        # Commit transaction
        await db.commit()

        return StandardResponse(
            detail="Feature Group created successfully",
            data={
                "feature_group_id": str(new_fg_id),
                "version": current_version
            }
        )
    except HTTPException:
        await db.rollback()
        raise
    except grpc.aio.AioRpcError as rpc_error:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Scheduling error: {rpc_error.details()}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"System error during creation: {str(e)}"
        )


@router.post("/webhook/status", response_model=StandardResponse[dict])
async def update_pipeline_status(
    payload: StatusPayload,
    db: AsyncSession = Depends(get_session)
):
    """
    Listen for status updates
    """
    try:
        # Parse UUID
        fg_uuid = uuid.UUID(payload.feature_group_id)

        # Get feature group
        fg = await db.get(FeatureGroup, fg_uuid)
        if not fg:
            return StandardResponse(
                detail="Skip update: Feature Group not found",
                data={"action": "ignored"}
            )

        fg.last_run_status = payload.status
        fg.updated_at = datetime.now(timezone.utc).timestamp()

        if payload.status == Materialization.FAILED.value:
            fg.is_scheduled = False
            fg.next_run_at = None

        await db.commit()

        # Websocket
        await manager.broadcast({
            "event": "FEATURE_GROUP_UPDATE",
            "data": {
                "id": str(fg.id),
                "status": payload.status,
                "updated_at": fg.updated_at
            }
        })

        return StandardResponse(
            detail="Status recorded successfully",
            data={"action": "updated", "status": payload.status}
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Invalid Feature Group ID format"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"System error while processing webhook: {str(e)}"
        )


@router.get("/feature-groups", response_model=StandardResponse[dict])
async def list_feature_groups(
    search: str | None = None,
    execution_status: str | None = Query(default=None, description="Filter by status (RUNNING, COMPLETED...)"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Get list feature group
    """
    filters = []
    if search:
        filters.append(FeatureGroup.name.ilike(f"%{search}%"))
    if execution_status:
        filters.append(FeatureGroup.last_run_status == execution_status)

    count_query = select(func.count(FeatureGroup.id))
    data_query = select(FeatureGroup)

    if filters:
        count_query = count_query.where(*filters)
        data_query = data_query.where(*filters)

    total = (await db.execute(count_query)).scalar() or 0

    data_query = (
        data_query
        .options(selectinload(FeatureGroup.transformation))
        .order_by(FeatureGroup.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )

    result = await db.execute(data_query)
    feature_groups = result.scalars().all()

    return StandardResponse(
        data={
            "items": [FeatureGroupRead.model_validate(feature_group).model_dump() for feature_group in feature_groups],
            "pagination": pagination.get_metadata(total)
        }
    )


@router.get("/feature-groups/{id}", response_model=StandardResponse[FeatureGroupDetail])
async def get_feature_group(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Get Detail
    """
    query = (
        select(FeatureGroup)
        .where(FeatureGroup.id == id)
        .options(selectinload(FeatureGroup.features))
    )

    result = await db.execute(query)
    fg = result.scalars().first()

    if not fg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature group not found"
        )

    data = FeatureGroupDetail(
        id=fg.id,
        name=fg.name,
        version=fg.version,
        status=fg.status,
        offline_uri=fg.offline_uri,
        updated_at=fg.updated_at,
        created_at=fg.created_at,
        features=fg.features,
        endpoint_url=settings.MINIO_ENDPOINT
    )

    return StandardResponse(data=data)


@router.patch("/feature-groups/{id}", response_model=StandardResponse[dict])
async def update_feature_group(
    id: uuid.UUID,
    payload: FeatureGroupUpdate,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Update feature group
    """
    fg = await db.get(FeatureGroup, id)
    if not fg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature group not found"
        )

    if "name" in payload.model_fields_set and payload.name != fg.name:
        if await db.scalar(select(FeatureGroup.id).where(FeatureGroup.name == payload.name)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Feature group name already exists"
            )

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return StandardResponse(
            detail="No data to update",
            data={"id": str(fg.id)}
        )

    future_is_scheduled = update_data.get("is_scheduled", fg.is_scheduled)
    future_status = update_data.get("status", fg.status)

    if future_is_scheduled:
        if fg.last_run_status == Materialization.FAILED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to enable scheduling: The last run failed. Please check your configuration"
            )

        if future_status in [FeatureGroupStatus.DEPRECATED, FeatureGroupStatus.INACTIVE]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to enable scheduling: Feature Group is currently inactive"
            )

    for key, value in update_data.items():
        setattr(fg, key, value)

    if fg.is_scheduled and fg.cron_expression:
        fg.next_run_at = calculate_next_run(fg.cron_expression)
    else:
        fg.is_scheduled = False
        fg.next_run_at = None

    await db.commit()

    return StandardResponse(
        detail="Update feature group successfully",
        data={
            "id": str(fg.id),
            "is_scheduled": fg.is_scheduled,
            "next_run_at": fg.next_run_at
        }
    )


@router.delete("/feature-groups/{id}", response_model=StandardResponse[dict])
async def delete_feature_group(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Delete feature group and child features (hard delete)
    """
    fg = await db.get(FeatureGroup, id)
    if not fg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature group not found"
        )

    await db.delete(fg)
    await db.commit()

    return StandardResponse(
        detail="Delete feature group successfully",
        data={"id": str(id), "action": "deleted"}
    )


@router.websocket("/ws/feature-groups")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
