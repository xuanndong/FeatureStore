# Standard Libraries
import uuid
import json
from datetime import datetime, timezone

# Third party Libraries
import s3fs
import grpc
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
import aiobotocore.session

# Local Libraries
from services.photon.core.responses import StandardResponse
from services.photon.core.dependencies import verify_api_version, PaginationParams
from services.photon.core.grpcClient import grpc_client
from services.photon.schemas.datasets import (
    RunScriptPayload, 
    DatasetAccessInfoData, 
    DatasetItem, 
    ScriptExecutionData
)
from common.database.models import FeatureGroup, FeatureView, MaterializationJob
from common.database.connection import get_session
from common.constants import DatasetsType, Materialization, FeatureGroupStatus
from common.config import settings
from common.grpc import featurePipeline_pb2 as pb2


router = APIRouter(prefix="/datasets", tags=["Datasets Features"])


def ensure_float_timestamp(dt_obj) -> float:
    """Helper to convert datetime to float or return float as is"""
    if dt_obj is None:
        return 0.0
    if isinstance(dt_obj, (int, float)):
        return float(dt_obj)
    if hasattr(dt_obj, 'timestamp'):
        return dt_obj.timestamp()
    return 0.0


@router.get('', response_model=StandardResponse[dict])
async def get_ready_datasets(
    dataset_type: DatasetsType | None = Query(None, description="Filter by GROUP or VIEW"),
    search: str | None = Query(None, description="Search by name or alias"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Get paginated list of datasets ready to use. Returns float timestamps.
    """
    try:
        raw_results = []

        # Query Feature Groups
        if dataset_type is None or dataset_type == DatasetsType.FEATURE_GROUP:
            fg_query = select(FeatureGroup).where(
                FeatureGroup.last_run_status == Materialization.COMPLETED.value,
                FeatureGroup.status == FeatureGroupStatus.ACTIVE.value
            )
            if search:
                fg_query = fg_query.where(FeatureGroup.name.ilike(f"%{search}%"))

            fgs = (await db.execute(fg_query)).scalars().all()

            for fg in fgs:
                item = DatasetItem(
                    dataset_id=str(fg.id),
                    name=fg.name, 
                    dataset_type=DatasetsType.FEATURE_GROUP.value,
                    created_at=ensure_float_timestamp(fg.created_at),
                )
                raw_results.append(item.model_dump())

        # Query Feature Views
        if dataset_type is None or dataset_type == DatasetsType.FEATURE_VIEW:
            fv_query = (
                select(FeatureView)
                .join(MaterializationJob, FeatureView.id == MaterializationJob.feature_view_id)
                .where(MaterializationJob.status == Materialization.COMPLETED.value)
                .distinct()
            )
            if search:
                fv_query = fv_query.where(FeatureView.name.ilike(f"%{search}%"))

            fvs = (await db.execute(fv_query)).scalars().all()

            for fv in fvs:
                item = DatasetItem(
                    dataset_id=str(fv.id),
                    name=fv.name,
                    dataset_type=DatasetsType.FEATURE_VIEW.value,
                    created_at=ensure_float_timestamp(fv.created_at),
                )
                raw_results.append(item.model_dump())

        # Sort & Paginate
        sorted_results = sorted(raw_results, key=lambda x: x['created_at'], reverse=True)
        total_items = len(sorted_results)

        start_idx = pagination.offset
        end_idx = pagination.offset + pagination.limit
        paginated_items = sorted_results[start_idx:end_idx]

        return StandardResponse(
            detail="Datasets retrieved successfully",
            data={
                "items": paginated_items,
                "pagination": pagination.get_metadata(total_items)
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"System error: {str(e)}"
        )


@router.get('/access-info', response_model=StandardResponse[DatasetAccessInfoData])
async def get_dataset_access_info(
    dataset_id: uuid.UUID = Query(..., description="ID of feature group or feature view"),
    dataset_type: DatasetsType = Query(..., description="GROUP or VIEW"),
    expires_in: int = Query(3600, description="Link expiration time (seconds)"),
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Generate temporary STS credentials for dataset access
    """
    offline_uri = None

    try:
        if dataset_type == DatasetsType.FEATURE_GROUP:
            fg = await db.get(FeatureGroup, dataset_id)
            if not fg:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature Group not found")
            if fg.last_run_status != Materialization.COMPLETED.value:
                raise HTTPException(status_code=400, detail="Incomplete data")
            offline_uri = fg.offline_uri

        elif dataset_type == DatasetsType.FEATURE_VIEW:
            query = (
                select(MaterializationJob)
                .where(
                    MaterializationJob.feature_view_id == dataset_id,
                    MaterializationJob.status == Materialization.COMPLETED.value
                )
                .order_by(MaterializationJob.created_at.desc())
                .limit(1)
            )
            job = (await db.execute(query)).scalars().first()

            if not job:
                raise HTTPException(status_code=404, detail="No data available")
            offline_uri = job.offline_uri

        # Remove error prefixes (in case of redundant 's3://' in DB)
        clean_uri = offline_uri.replace("s3://", "").strip("/")

        # S3 Logic: Split bucket and directory
        path_parts = clean_uri.split("/", 1)
        bucket_name = path_parts[0]
        prefix = path_parts[1] if len(path_parts) > 1 else ""

        # Create IAM Policy
        iam_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "s3:ListBucket", 
                        "s3:GetBucketLocation"
                    ],
                    "Resource": [f"arn:aws:s3:::{bucket_name}"]
                },
                {
                    "Effect": "Allow",
                    "Action": ["s3:GetObject"],
                    "Resource": [
                        f"arn:aws:s3:::{bucket_name}/{prefix}/*",
                        f"arn:aws:s3:::{bucket_name}/{prefix}/",
                        f"arn:aws:s3:::{bucket_name}/{prefix}"
                    ]
                }
            ]
        }

        # Call AWS STS
        public_endpoint = getattr(settings, "MINIO_PUBLIC_ENDPOINT", settings.MINIO_ENDPOINT)
        session = aiobotocore.session.get_session()

        async with session.create_client(
            'sts',
            endpoint_url=public_endpoint,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            region_name='us-east-1'
        ) as sts_client:
            response = await sts_client.assume_role(
                RoleArn="arn:aws:iam::123456789012:role/aether-sts-role", 
                RoleSessionName=f"session_{str(dataset_id)[:8]}",
                Policy=json.dumps(iam_policy),
                DurationSeconds=expires_in
            )
        credentials = response['Credentials']
        clean_uri = offline_uri.replace("s3://", "").strip("/")

        final_dataset_uri = f"s3://{clean_uri}"
        if not final_dataset_uri.endswith('/'):
            final_dataset_uri += "/"

        access_data = DatasetAccessInfoData(
            dataset_id=str(dataset_id),
            dataset_type=dataset_type.value,
            dataset_uri=final_dataset_uri, 
            access_key=credentials['AccessKeyId'],
            secret_key=credentials['SecretAccessKey'],
            session_token=credentials['SessionToken'],
            data_format="Apache Parquet",
            expires_at=credentials['Expiration'].timestamp()
        )

        return StandardResponse(
            detail="STS Credentials generated successfully",
            data=access_data.model_dump()
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"System error: {str(e)}"
        )


@router.post('/experiments', response_model=StandardResponse[ScriptExecutionData])
async def run_in_system_script(
    payload: RunScriptPayload,
    db: AsyncSession = Depends(get_session),
    version: str = Depends(verify_api_version)
):
    """
    Execute user script on Ray Cluster
    """
    try:
        offline_uri = None
        if payload.dataset_type == DatasetsType.FEATURE_GROUP:
            fg = await db.get(FeatureGroup, uuid.UUID(payload.dataset_id))
            if fg: offline_uri = fg.offline_uri
        else:
            query = select(MaterializationJob).where(
                MaterializationJob.feature_view_id == uuid.UUID(payload.dataset_id),
                MaterializationJob.status == Materialization.COMPLETED.value
            ).order_by(MaterializationJob.created_at.desc()).limit(1)

            job = (await db.execute(query)).scalars().first()
            if job: offline_uri = job.offline_uri

        if not offline_uri:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Data path not found"
            )

        clean_uri = offline_uri.replace("s3://", "").strip("/")
        final_dataset_uri = f"s3://{clean_uri}"

        if not final_dataset_uri.endswith('/'):
            final_dataset_uri += "/"

        request = pb2.ExecuteScriptRequest(
            script_code=payload.code,
            requirements=payload.requirements,
            dataset_uri=final_dataset_uri
        )

        response = await grpc_client.execute_user_script(request)

        analytics_data = {}
        if response.analytics_json:
            try:
                analytics_data = json.loads(response.analytics_json)
            except json.JSONDecodeError:
                analytics_data = {"error": "Chart data parsing error"}

        if response.status == "FAILED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Code execution error:\n{response.error_message}\n\nLogs:\n{response.logs}"
            )

        exec_data = ScriptExecutionData(
            logs=response.logs,
            analytics=analytics_data
        )

        return StandardResponse(
            detail="Code execution successful",
            data=exec_data.model_dump()
        )
    except grpc.RpcError as e:
        if e.code() == grpc.StatusCode.DEADLINE_EXCEEDED:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Execution time exceeded 1 hour limit"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"gRPC connection error: {e.details()}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"System error: {str(e)}"
        )
