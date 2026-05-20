# Standard Libraries
import asyncio
import logging
import json
from datetime import datetime, timezone

# Third party Libraries
from sqlmodel import select
from sqlalchemy.orm import selectinload

# Local Libraries
from common.database.connection import async_session_maker
from common.database.models import FeatureGroup
from common.constants import FeatureGroupStatus, Materialization
from common.config import settings
from common.grpc import featurePipeline_pb2 as pb2
from services.photon.core.grpcClient import grpc_client
from services.photon.core.utils import calculate_next_run

logger = logging.getLogger(__name__)


async def run_scheduler():
    """
    Background task to periodically check for scheduled Feature Groups
    and trigger their data materialization pipelines.
    """
    logger.info("Feature Group Scheduler started.")
    
    while True:
        try:
            current_time = datetime.now(timezone.utc).timestamp()
            
            async with async_session_maker() as session:
                query = (
                    select(FeatureGroup)
                    .where(
                        FeatureGroup.is_scheduled == True,
                        FeatureGroup.status == FeatureGroupStatus.ACTIVE,
                        FeatureGroup.last_run_status == Materialization.COMPLETED,
                        FeatureGroup.next_run_at <= current_time
                    )
                    .options(
                        selectinload(FeatureGroup.entity),
                        selectinload(FeatureGroup.source),
                        selectinload(FeatureGroup.transformation),
                    )
                )
                result = await session.execute(query)
                feature_groups = result.scalars().all()
                
                for fg in feature_groups:
                    logger.info(f"Triggering scheduled run for FeatureGroup: {fg.name} (ID: {fg.id})")
                    
                    try:
                        # Map SourceFormat
                        source_format = fg.source.source_format
                        format_name = source_format.name if hasattr(source_format, 'name') else str(source_format).upper()
                        proto_source_format = getattr(pb2.SourceFormat, format_name, pb2.SourceFormat.UNKNOWN_FORMAT)
                        
                        # Map TransformationType
                        has_trans = fg.transformation is not None
                        proto_trans_type = pb2.TransformationType.UNKNOWN_TYPE
                        trans_def = ""
                        clean_reqs = []
                        
                        if has_trans:
                            t_type_val = fg.transformation.t_type
                            transform_name = t_type_val.name if hasattr(t_type_val, 'name') else str(t_type_val).upper()
                            proto_trans_type = getattr(pb2.TransformationType, transform_name, pb2.TransformationType.UNKNOWN_TYPE)
                            trans_def = fg.transformation.definition
                            clean_reqs = fg.transformation.requirements or []

                        # Other configs
                        connection_options_json = json.dumps(fg.source.connection_options, default=str) if fg.source.connection_options else ""
                        join_key = fg.entity.join_key if fg.entity else ""
                        
                        # Build gRPC Request
                        run_req = pb2.RunRequest(
                            location_uri=fg.source.location_uri,
                            output_uri=fg.offline_uri or "",
                            source_format=proto_source_format,
                            transform_type=proto_trans_type,
                            transform_definition=trans_def,
                            connection_options_json=connection_options_json,
                            feature_group_id=str(fg.id),
                            webhook_url=settings.WEBHOOK_URL,
                            join_key=join_key,
                            read_policy=pb2.ReadPolicy.NEW_VALUES, # Only read new data
                            sync_online=False
                        )
                        
                        if clean_reqs:
                            run_req.requirements.extend(clean_reqs)
                        
                        # Trigger pipeline
                        await grpc_client.run_pipeline(run_req)
                        
                        # Update status and schedule next run
                        fg.last_run_status = Materialization.PENDING
                        fg.next_run_at = calculate_next_run(fg.cron_expression)
                        
                        await session.commit()
                        logger.info(f"Successfully triggered scheduled pipeline for FeatureGroup: {fg.name}")
                        
                    except Exception as e:
                        logger.error(f"Failed to trigger scheduled run for FeatureGroup {fg.name} (ID: {fg.id}): {e}")
                        # Rollback the transaction for this specific group so others can process
                        await session.rollback()
                        
        except asyncio.CancelledError:
            logger.info("Feature Group Scheduler stopping due to cancellation...")
            break
        except Exception as e:
            logger.error(f"Unexpected error in Feature Group Scheduler loop: {e}")
            
        # Sleep for 60 seconds before checking again
        await asyncio.sleep(60)
