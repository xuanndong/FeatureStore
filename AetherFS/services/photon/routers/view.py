# Standard Libraries
import re
import uuid
from datetime import datetime, timezone

# Third Libraries
from fastapi import APIRouter, Depends, HTTPException, status, Request, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func
import grpc

# Local Libraries
from common.database.models import FeatureGroup, Feature, FeatureView, FeatureViewMember, Entity, MaterializationJob
from common.grpc import featurePipeline_pb2 as pb2
from common.constants import Materialization
from common.config import settings
from common.database.connection import get_session
from services.photon.schemas.view import FeatureDiscoveryRead, FeatureViewCreate, FeatureViewDetailRead, FeatureViewListRead, FeatureViewUpdate, JobStatusPayload, MaterializationRead
from services.photon.core.responses import StandardResponse
from services.photon.core.dependencies import verify_api_version, PaginationParams
from services.photon.core.websocket import manager
from services.photon.core.grpcClient import grpc_client


router = APIRouter(prefix="/views", tags=["Feature Views"])


@router.get("/available-features", response_model=StandardResponse[list[FeatureDiscoveryRead]])
async def list_available_features(
    search: str | None = None,
    entity_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Retrieve all available features to construct the View.
    Supports filtering by Entity to prevent UI overload.
    """
    query = (
        select(
            Feature,
            FeatureGroup.name.label("group_name"),
            Entity.id.label("entity_id"),
            Entity.name.label("entity_name")
        )
        .join(FeatureGroup, Feature.group_id == FeatureGroup.id)
        .join(Entity, FeatureGroup.entity_id == Entity.id)
    )

    if search:
        query = query.where(
            Feature.name.ilike(f"%{search}%") | FeatureGroup.name.ilike(f"%{search}%")
        )

    if entity_id:
        query = query.where(Entity.id == entity_id)

    result = await db.execute(query.order_by(Entity.name, FeatureGroup.name, Feature.name))
    rows = result.all()

    data = [
        FeatureDiscoveryRead(
            **row[0].model_dump(),
            group_name=row[1],
            entity_id=row[2],
            entity_name=row[3]
        ) for row in rows
    ]

    return StandardResponse(data=data)


@router.post("/feature-views", response_model=StandardResponse[dict])
async def create_feature_view(
    request: Request,
    payload: FeatureViewCreate,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Initialize a new Feature View based on the selected features.
    Strictly validates that all features belong to the declared Entity.
    """
    base_uri = settings.OFFLINE_STORE_URI.rstrip('/')

    try:
        existing = await db.scalar(select(FeatureView).where(FeatureView.name == payload.name))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Feature View name already exists"
            )

        feature_query = (
            select(Feature, FeatureGroup)
            .join(FeatureGroup, Feature.group_id == FeatureGroup.id)
            .where(Feature.id.in_(payload.feature_ids))
        )
        results = await db.execute(feature_query)
        rows = results.all()

        if len(rows) != len(set(payload.feature_ids)):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Some features do not exist"
            )

        invalid_features = [
            feature.name 
            for feature, feature_group in rows 
            if feature_group.entity_id != payload.entity_id
        ]
        if invalid_features:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=f"Join Key Error: Features {invalid_features} do not belong to the selected Entity"
            )

        group_version_map = {}
        for feature, feature_group in rows:
            if feature_group.name not in group_version_map:
                group_version_map[feature_group.name] = set()

            group_version_map[feature_group.name].add(feature_group.version)

        conflicting_groups = [group_name for group_name, versions in group_version_map.items() if len(versions) > 1]
        if conflicting_groups:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Version Conflict Error: Merging different versions of the same feature group {conflicting_groups} into a single View is not allowed"
            )

        entity = await db.get(Entity, payload.entity_id)
        if not entity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Entity not found"
            )
        
        join_key = entity.join_key

        new_view = FeatureView(
            name=payload.name,
            ttl_seconds=payload.ttl_seconds,
            entity_id=payload.entity_id
        )
        db.add(new_view)
        await db.flush()

        for f_id in payload.feature_ids:
            member = FeatureViewMember(view_id=new_view.id, feature_id=f_id)
            db.add(member)

        new_job_id = uuid.uuid4()
        output_uri = f"{base_uri}/materialized/{new_view.id}/{new_job_id}"

        new_job = MaterializationJob(
            id=new_job_id,
            feature_view_id=new_view.id,
            status=Materialization.PENDING.value,
            offline_uri=output_uri
        )
        db.add(new_job)
        await db.flush()

        fg_metadata_map = {}
        for feature, feature_group in rows:
            fg_id = feature_group.id
            if fg_id not in fg_metadata_map:
                raw_name = feature_group.name
                clean_name = re.sub(r'\W+', '_', raw_name).strip('_').lower()
                safe_alias = f"{clean_name}_t{len(fg_metadata_map)}"

                fg_metadata_map[fg_id] = {
                    "alias": safe_alias,
                    "location_uri": feature_group.offline_uri,
                    "features": []
                }
            fg_metadata_map[fg_id]["features"].append(feature.name)

        proto_feature_groups = [
            pb2.FeatureGroupMeta(
                alias=meta["alias"],
                location_uri=meta["location_uri"],
                features=meta["features"]
            )
            for meta in fg_metadata_map.values()
        ]

        webhook_url = f"{settings.WEBHOOK_URL}/materialized"
            
        view_req = pb2.MaterializeViewRequest(
            job_id=str(new_job_id),
            view_id=str(new_view.id),
            join_key=join_key,
            feature_groups=proto_feature_groups,
            output_uri=output_uri,
            webhook_url=webhook_url
        )

        run_res = await grpc_client.materialize_feature_view(view_req)
            
        new_job.status = run_res.status
        new_job.updated_at = datetime.now(timezone.utc).timestamp()

        await db.commit()

        return StandardResponse(
            detail="Feature View created and materialization job triggered successfully",
            data={
                "view_id": str(new_view.id),
                "job_id": str(new_job.id),
                "name": new_view.name,
                "status": run_res.status
            }
        )
    except HTTPException:
        await db.rollback()
        raise
    except grpc.aio.AioRpcError as rpc_error:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Materialization scheduling error: {rpc_error.details()}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"System error during Feature View creation: {str(e)}"
        )


@router.get("/feature-views", response_model=StandardResponse[dict])
async def list_feature_views(
    search: str | None = None,
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    List paginated feature views with feature count
    """
    filters = []
    if search:
        filters.append(FeatureView.name.ilike(f"%{search}%"))

    count_query = select(func.count(FeatureView.id))
    
    data_query = (
        select(
            FeatureView,
            func.count(FeatureViewMember.feature_id).label("feature_count")
        )
        .outerjoin(FeatureViewMember, FeatureView.id == FeatureViewMember.view_id)
        .group_by(FeatureView.id)
    )

    if filters:
        count_query = count_query.where(*filters)
        data_query = data_query.where(*filters)

    total = (await db.execute(count_query)).scalar() or 0

    data_query = (
        data_query
        .order_by(FeatureView.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )

    result = await db.execute(data_query)
    rows = result.all()

    views_data = []
    for view, count in rows:
        view_dict = view.model_dump()
        view_dict["feature_count"] = count
        
        views_data.append(FeatureViewListRead(**view_dict).model_dump())

    return StandardResponse(
        data={
            "items": views_data,
            "pagination": pagination.get_metadata(total)
        }
    )


@router.get("/feature-views/{id}", response_model=StandardResponse[FeatureViewDetailRead])
async def get_feature_view_detail(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Fetch Feature View details and the list of all contained features
    """
    view = await db.get(FeatureView, id)
    if not view:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature View not found"
        )

    feature_query = (
        select(
            Feature,
            FeatureGroup.name.label("group_name"),
            Entity.id.label("entity_id"),
            Entity.name.label("entity_name")
        )
        .join(FeatureViewMember, Feature.id == FeatureViewMember.feature_id)
        .join(FeatureGroup, Feature.group_id == FeatureGroup.id)
        .join(Entity, FeatureGroup.entity_id == Entity.id)
        .where(FeatureViewMember.view_id == id)
    )

    result = await db.execute(feature_query)
    feature_rows = result.all()

    features_list = [
        FeatureDiscoveryRead(
            **row[0].model_dump(), 
            group_name=row[1],
            entity_id=row[2],
            entity_name=row[3]
        )
        for row in feature_rows
    ]

    data = FeatureViewDetailRead(
        id=view.id,
        name=view.name,
        ttl_seconds=view.ttl_seconds,
        entity_id=view.entity_id,
        created_at=view.created_at,
        features=features_list
    )

    return StandardResponse(data=data)


@router.delete("/feature-views/{id}", response_model=StandardResponse[dict])
async def delete_feature_view(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Delete feature view
    """
    view = await db.get(FeatureView, id)
    if not view:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature View not found"
        )

    await db.delete(view)
    await db.commit()

    return StandardResponse(
        detail="Feature View deleted successfully",
    )


@router.patch("/feature-views/{id}", response_model=StandardResponse[dict])
async def update_feature_view(
    id: uuid.UUID,
    payload: FeatureViewUpdate,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Update feature view metadata
    """
    view = await db.get(FeatureView, id)
    if not view:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature View not found"
        )

    update_data = payload.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != view.name:
        if await db.scalar(select(FeatureView.id).where(FeatureView.name == update_data["name"])):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Feature View name already exists"
            )

    for key, value in update_data.items():
        setattr(view, key, value)

    await db.commit()
    await db.refresh(view)

    return StandardResponse(
        detail="Feature View updated successfully",
        data=view.model_dump()
    )


@router.post("/webhook/status/materialized", response_model=StandardResponse[dict])
async def update_materialization_job_status(
    payload: JobStatusPayload,
    db: AsyncSession = Depends(get_session)
):
    """
    Listen for Materialization Job status updates from Ray Cluster
    """
    try:
        job_uuid = uuid.UUID(payload.job_id)

        job = await db.get(MaterializationJob, job_uuid)
        if not job:
            return StandardResponse(
                detail="Skip update: Materialization Job not found",
                data={"action": "ignored"}
            )

        job.status = payload.status
        job.updated_at = datetime.now(timezone.utc).timestamp()

        if payload.status == Materialization.RUNNING.value:
            if not job.start_time:
                job.start_time = job.updated_at

        elif payload.status in [Materialization.COMPLETED.value, Materialization.FAILED.value, Materialization.CANCELED.value]:
            job.end_time = job.updated_at

        if payload.status == Materialization.FAILED.value:
            job.error_message = payload.message

        await db.commit()

        # Websocket
        await manager.broadcast({
            "event": "MATERIALIZATION_JOB_UPDATE",
            "data": {
                "id": str(job.id),
                "feature_view_id": str(job.feature_view_id),
                "status": payload.status,
                "message": payload.message,
                "updated_at": job.updated_at
            }
        })

        return StandardResponse(
            detail="Job status recorded successfully",
            data={"action": "updated", "status": payload.status}
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Invalid Job ID format"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"System error while processing webhook: {str(e)}"
        )


@router.websocket("/ws/materialization")
async def feature_view_websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(websocket)


@router.get("/materialization-jobs", response_model=StandardResponse[dict])
async def list_materialization_jobs(
    feature_view_id: uuid.UUID | None = Query(default=None, description="Filter by Feature View ID"),
    execution_status: str | None = Query(default=None, description="Filter by status (PENDING, RUNNING, COMPLETED...)"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Get list of materialization jobs
    """
    filters = []
    if feature_view_id:
        filters.append(MaterializationJob.feature_view_id == feature_view_id)
    if execution_status:
        filters.append(MaterializationJob.status == execution_status)

    count_query = select(func.count(MaterializationJob.id))
    data_query = select(MaterializationJob)

    if filters:
        count_query = count_query.where(*filters)
        data_query = data_query.where(*filters)

    total = (await db.execute(count_query)).scalar() or 0

    data_query = (
        data_query
        .order_by(MaterializationJob.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )

    result = await db.execute(data_query)
    jobs = result.scalars().all()

    return StandardResponse(
        data={
            "items": [MaterializationRead.model_validate(job).model_dump() for job in jobs],
            "pagination": pagination.get_metadata(total)
        }
    )
