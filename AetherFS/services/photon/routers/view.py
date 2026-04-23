# Standard Libraries
import uuid

# Third Libraries
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

# Local Libraries
from common.database.models import FeatureGroup, Feature, FeatureView, FeatureViewMember
from common.database.connection import get_session
from services.photon.schemas.view import FeatureDiscoveryRead, FeatureViewCreate, FeatureViewDetailRead, FeatureViewListRead, FeatureViewUpdate
from services.photon.core.responses import StandardResponse
from services.photon.core.dependencies import verify_api_version


router = APIRouter(prefix="/views", tags=["Feature Views"])


@router.get("/available-features", response_model=StandardResponse[list[FeatureDiscoveryRead]])
async def list_available_features(
    search: str | None = None,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Retrieve all available features to construct the View
    """
    query = select(Feature, FeatureGroup.name.label("group_name")).join(FeatureGroup)

    if search:
        query = query.where(
            Feature.name.ilike(f"%{search}%") | FeatureGroup.name.ilike(f"%{search}%")
        )

    result = await db.execute(query.order_by(FeatureGroup.name, Feature.name))
    rows = result.all()

    data = [
        FeatureDiscoveryRead(
            **row[0].model_dump(),
            group_name=row[1]
        ) for row in rows
    ]

    return StandardResponse(data=data)


@router.post("/feature-views", response_model=StandardResponse[dict])
async def create_feature_view(
    payload: FeatureViewCreate,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Initialize a new Feature View based on the selected features
    """
    existing = await db.scalar(select(FeatureView).where(FeatureView.name == payload.name))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feature View name already exists"
        )
    
    new_view = FeatureView(
        name=payload.name,
        ttl_seconds=payload.ttl_seconds
    )
    db.add(new_view)
    await db.flush()

    for f_id in payload.feature_ids:
        feature_exists = await db.get(Feature, f_id)
        if not feature_exists:
            continue

        member = FeatureViewMember(view_id=new_view.id, feature_id=f_id)
        db.add(member)

    await db.commit()

    return StandardResponse(
        detail="Feature View generated successfully",
        data={
            "id": str(new_view.id),
            "name": new_view.name
        }
    )


@router.get("/feature-views", response_model=StandardResponse[list[FeatureViewListRead]])
async def list_feature_views(
    search: str | None = None,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Feature views list with feature count
    """
    query = (
        select(
            FeatureView,
            func.count(FeatureViewMember.feature_id).label("feature_count")
        )
        .outerjoin(FeatureViewMember, FeatureView.id == FeatureViewMember.view_id)
        .group_by(FeatureView.id)
        .order_by(FeatureView.created_at.desc())
    )

    if search:
        query = query.where(FeatureView.name.ilike(f"%{search}%"))

    result = await db.execute(query)
    rows = result.all()

    views_data = []
    for view, count in rows:
        view_dict = view.model_dump()
        view_dict["feature_count"] = count

        views_data.append(FeatureViewListRead(**view_dict))

    return StandardResponse(data=views_data)


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
            detail="Feature view not found"
        )

    feature_query = (
        select(Feature, FeatureGroup.name.label("group_name"))
        .join(FeatureViewMember, Feature.id == FeatureViewMember.feature_id)
        .join(FeatureGroup, Feature.group_id == FeatureGroup.id)
        .where(FeatureViewMember.view_id == id)
    )

    result = await db.execute(feature_query)
    feature_rows = result.all()

    features_list = [
        FeatureDiscoveryRead(**feature[0].model_dump(), group_name=feature[1])
        for feature in feature_rows
    ]

    data = FeatureViewDetailRead(
        id=view.id,
        name=view.name,
        ttl_seconds=view.ttl_seconds,
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
            detail="Feature view not found"
        )

    await db.delete(view)
    await db.commit()

    return StandardResponse(
        detail="Feature view deleted successfully",
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
            detail="Feature view not found"
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
        detail="Feature view updated successfully",
        data=view
    )