# Standard Libraries
import logging
import json
import concurrent.futures
import sys
import os
import time
import io

# Path processing
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "common", "grpc"))

# Third party Libraries
import grpc
from grpc_reflection.v1alpha import reflection
import ray
import psutil

# Generated Proto files
from common.grpc import featurePipeline_pb2 as pb2
from common.grpc import featurePipeline_pb2_grpc as pb2_grpc

# Local Libraries
from common.constants import TransformationType, ReadPolicies, SourceFormat, Materialization
from common.config import settings
from core.batchRunner import BatchPipelineRunner
from core.utils import analytics
from core import webhook


# Logs
logger = logging.getLogger(__name__)


@ray.remote
def run_script_on_ray_worker(script_code: str, dataset_uri: str):
    """
    Execute code, collect Console Logs and Auto-Metrics
    """    
    old_stdout = sys.stdout
    redirected_output = sys.stdout = io.StringIO()
    
    error_msg = ""
    
    start_time = time.time()
    process = psutil.Process()
    start_memory = process.memory_info().rss
    
    try:
        user_context = {
            "aether_log": analytics,
            "DATASET_PATH": dataset_uri,
            "__name__": "__main__"
        }

        exec(script_code, user_context)
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
    finally:
        sys.stdout = old_stdout
        
        end_time = time.time()
        end_memory = process.memory_info().rss
        
        exec_time = round(end_time - start_time, 2)
        mem_used_mb = round((end_memory - start_memory) / (1024 * 1024), 2)
        
        analytics.log_scalar("Execution time:", exec_time, "s")
        analytics.log_scalar("RAM Usage:", max(0, mem_used_mb), "MB")

    return {
        "status": "FAILED" if error_msg else "SUCCESS",
        "logs": redirected_output.getvalue(),
        "error_message": error_msg,
        "analytics_json": json.dumps(analytics.metrics)
    }


@ray.remote
def execute_pipeline_in_background(kwargs: dict, feature_group_id: str, webhook_url: str):
    """
    Execute task on an idle ray cluster worker
    """
    try:
        webhook.report_status(webhook_url, feature_group_id, Materialization.RUNNING.value, "Pipeline is currently running")

        # Init runner
        runner = BatchPipelineRunner()
        saved_metadata = runner.run(**kwargs)

        # Update status
        msg = f"Successfully processed {len(saved_metadata)} datasets"
        webhook.report_status(webhook_url, feature_group_id, Materialization.COMPLETED.value, msg)
    except Exception as e:
        worker_logger = logging.getLogger(__name__)
        worker_logger.error(f"Data processing error for {feature_group_id}: {str(e)}")
        webhook.report_status(webhook_url, feature_group_id, Materialization.FAILED.value, f"Error: {str(e)}")


@ray.remote
def execute_view_materialization(kwargs: dict, job_id: str, webhook_url: str):
    """
    Execute Feature View merge task
    """
    try:
        webhook.report_job_status(
            webhook_url=webhook_url, 
            job_id=job_id, 
            status=Materialization.RUNNING.value, 
            message="Started view materialization process..."
        )

        runner = BatchPipelineRunner()

        output_metadata = runner.run_view(**kwargs)

        row_count = output_metadata.get('row_count', 0)
        final_uri = output_metadata.get('final_uri', 'Unknown URI')

        msg = f"Successfully materialized view. Saved {row_count} rows to {final_uri}"
        webhook.report_job_status(
            webhook_url=webhook_url, 
            job_id=job_id, 
            status=Materialization.COMPLETED.value, 
            message=msg
        )
        
    except Exception as e:
        worker_logger = logging.getLogger(__name__)
        worker_logger.error(f"View processing error for job {job_id}: {str(e)}", exc_info=True)
        
        webhook.report_job_status(
            webhook_url=webhook_url, 
            job_id=job_id, 
            status=Materialization.FAILED.value, 
            message=f"System Error: {str(e)}"
        )


class FeaturePipelineAPI(pb2_grpc.PipelineServiceServicer):
    def __init__(self):
        self.runner = BatchPipelineRunner()
        logger.info("gRPC API Initialized. Ready to dispatch tasks to Cluster!")

    def _parse_json_safe(self, json_str: str):
        if not json_str:
            return None
        try:
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.error(f"JSON Parse Error: {e}")
            raise ValueError(f"Invalid JSON format: {json_str}")

    def _map_source_format(self, proto_format) -> SourceFormat:
        mapping = {
            pb2.SourceFormat.CSV: SourceFormat.CSV,
            pb2.SourceFormat.PARQUET: SourceFormat.PARQUET,
            pb2.SourceFormat.AVRO: SourceFormat.AVRO,
            pb2.SourceFormat.JSON: SourceFormat.JSON,
            pb2.SourceFormat.IMAGE: SourceFormat.IMAGE,
            pb2.SourceFormat.TEXT: SourceFormat.TEXT,
            pb2.SourceFormat.AUDIO: SourceFormat.AUDIO,
            pb2.SourceFormat.VIDEO: SourceFormat.VIDEO,
            pb2.SourceFormat.BINARY: SourceFormat.BINARY,
        }

        return mapping.get(proto_format, SourceFormat.CSV)

    def _map_transform_type(self, proto_type) -> TransformationType:
        mapping = {
            pb2.TransformationType.SQL: TransformationType.SQL,
            pb2.TransformationType.PYTHON_UDF: TransformationType.PYTHON_UDF,
            pb2.TransformationType.AGGREGATION: TransformationType.AGGREGATION,
        }

        return mapping.get(proto_type, TransformationType.SQL)

    def _map_read_policy(self, proto_policy) -> ReadPolicies:
        if proto_policy == pb2.ReadPolicy.NEW_VALUES:
            return ReadPolicies.NEW_VALUES

        return ReadPolicies.FULL_READ

    def _extract_agg_config(self, request):
        if not request.HasField('aggregation_config'):
            return None, None, None, None

        agg = request.aggregation_config
        entity_keys = list(agg.entity_keys) if agg.entity_keys else None
        time_col = agg.time_column if agg.time_column else None
        feat_cfg = self._parse_json_safe(agg.features_config_json)
        windows = list(agg.windows) if agg.windows else None

        return entity_keys, time_col, feat_cfg, windows

    def _build_run_kwargs(self, run_req):
        conn_opts = self._parse_json_safe(run_req.connection_options_json)
        entity_keys, time_col, feat_cfg, windows = self._extract_agg_config(run_req)

        return {
            "location_uri": run_req.location_uri,
            "output_uri": run_req.output_uri,
            "source_format": self._map_source_format(run_req.source_format),
            "transform_type": self._map_transform_type(run_req.transform_type),
            "transform_definition": run_req.transform_definition,
            "connection_options": conn_opts,
            "last_updated": run_req.last_updated if run_req.last_updated > 0 else None,
            "read_policy": self._map_read_policy(run_req.read_policy),
            "requirements": list(run_req.requirements),
            "target_datasets": list(run_req.target_datasets),
            "entity_keys": entity_keys,
            "time_column": time_col,
            "features_config": feat_cfg,
            "windows": windows,
            "sync_online": run_req.sync_online,
            "time_to_live": run_req.time_to_live if run_req.HasField('time_to_live') else None
        }

    def PreviewFeatureGroup(self, request, context):
        logger.info(f"Received Preview request for URI: {request.location_uri}")
        try:
            conn_opts = self._parse_json_safe(request.connection_options_json)

            # Extract Aggregation Config from nested message
            entity_keys, time_col, feat_cfg, windows = self._extract_agg_config(request)

            raw_preview_results = self.runner.preview(
                location_uri=request.location_uri,
                source_format=self._map_source_format(request.source_format),
                transform_type=self._map_transform_type(request.transform_type),
                transform_definition=request.transform_definition,
                connection_options=conn_opts,
                # For UDF Structure
                requirements=list(request.requirements),
                target_datasets=list(request.target_datasets),
                # For Aggregation
                entity_keys=entity_keys,
                time_column=time_col,
                features_config=feat_cfg,
                windows=windows,
                limit=request.limit if request.limit > 0 else 10
            )

            response = pb2.PreviewResponse()
            for ds_name, records in raw_preview_results.items():
                response.results_json[ds_name] = json.dumps(records)

            return response
        except Exception as e:
            logger.error(f"Preview Pipeline Failed: {str(e)}", exc_info=True)
            context.abort(grpc.StatusCode.INTERNAL, str(e))

    def RunBatchPipeline(self, request, context):
        logger.info(f"Received Run request for Feature Group: {request.feature_group_id}")
        try:
            kwargs = self._build_run_kwargs(request)
            webhook_url = request.webhook_url if request.HasField("webhook_url") else ""

            execute_pipeline_in_background.remote(
                kwargs=kwargs,
                feature_group_id=request.feature_group_id,
                webhook_url=webhook_url
            )

            return pb2.RunResponse(
                feature_group_id=request.feature_group_id,
                status=Materialization.PENDING.value,
                message="Process submitted to Cluster"
            )
        except Exception as e:
            logger.error(f"Run Pipeline Submission Failed: {str(e)}", exc_info=True)
            context.abort(grpc.StatusCode.INTERNAL, str(e))

    def MaterializeFeatureView(self, request, context):
        logger.info(f"Received Materialize View request for Job: {request.job_id} (View: {request.view_id})")
        try:
            feature_groups = [
                {
                    "alias": fg.alias,
                    "location_uri": fg.location_uri,
                    "features": list(fg.features)
                }
                for fg in request.feature_groups
            ]

            execute_view_materialization.remote(
                kwargs={
                    "join_key": request.join_key,
                    "feature_groups": feature_groups,
                    "output_uri": request.output_uri
                },
                job_id=request.job_id,
                webhook_url=request.webhook_url if request.HasField("webhook_url") else ""
            )

            return pb2.MaterializeViewResponse(
                job_id=request.job_id,
                status=Materialization.PENDING.value,
                message="View materialization submitted to Cluster"
            )
        except Exception as e:
            logger.error(f"Materialize View Submission Failed: {str(e)}", exc_info=True)
            context.abort(grpc.StatusCode.INTERNAL, str(e))
    

    def ExecuteUserScript(self, request, context):
        logger.info("Received ExecuteUserScript request for In-System Execution")
        try:
            clean_reqs = [r.strip() for r in request.requirements if r.strip()]
            runtime_env = {
                "pip": clean_reqs,
                "env_vars": {
                    "AWS_ACCESS_KEY_ID": settings.MINIO_ACCESS_KEY,
                    "AWS_SECRET_ACCESS_KEY": settings.MINIO_SECRET_KEY,
                    "AWS_ENDPOINT_URL": settings.MINIO_ENDPOINT,
                    "S3_ENDPOINT_URL": settings.MINIO_ENDPOINT,
                    "AWS_REGION": "us-east-1",
                    "AWS_ALLOW_HTTP": "true"
                }
            }

            task = run_script_on_ray_worker.options(
                runtime_env=runtime_env,
                # num_cpus=1,
                # memory=2 * 1024 * 1024 * 1024 # 2GB
            ).remote(
                request.script_code,
                request.dataset_uri
            )

            result = ray.get(task, timeout=settings.EXECUTION_TIMEOUT)

            return pb2.ExecuteScriptResponse(
                status=result["status"],
                logs=result["logs"],
                error_message=result["error_message"],
                analytics_json=result["analytics_json"]
            )
        except ray.exceptions.RuntimeEnvSetupError as e:
            return pb2.ExecuteScriptResponse(
                status="FAILED",
                error_message=f"Library setup error: {str(e)}"
            )
        except ray.exceptions.GetTimeoutError:
            ray.cancel(task, force=True)
            return pb2.ExecuteScriptResponse(
                status="FAILED",
                error_message="Execution timed out"
            )
        except Exception as e:
            logger.error(f"Fatal error: {str(e)}", exc_info=True)
            context.abort(grpc.StatusCode.INTERNAL, f"Internal Error: {str(e)}")


def serve():
    instance = FeaturePipelineAPI()

    server = grpc.server(concurrent.futures.ThreadPoolExecutor(max_workers=10))
    pb2_grpc.add_PipelineServiceServicer_to_server(instance, server)

    # Enable Reflection to allow testing via Postman
    SERVICE_NAMES = (
        pb2.DESCRIPTOR.services_by_name['PipelineService'].full_name,
        reflection.SERVICE_NAME,
    )
    reflection.enable_server_reflection(SERVICE_NAMES, server)

    port = "50051"
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    logger.info(f"Feature Transformation gRPC server is running on port {port}...")

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        print("\n[bold red]Stopping...[/bold red]")
        logger.info("Shutdown system")
        server.stop(5).wait()


if __name__ == "__main__":
    import builtins
    from rich import print as printr
    from rich import traceback, pretty
    from rich.logging import RichHandler
    from rich.console import Console
    from rich.theme import Theme

    # Override
    builtins.print = printr

    # Rich
    traceback.install()
    pretty.install()

    console = Console(theme=Theme({"log.time": "yellow"}))

    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s", handlers=[RichHandler(console=console)])

    print("""[bold cyan]
    ╔═╗╔═╗╔╦╗╦ ╦╔═╗╦═╗
    ╠═╣║╣  ║ ╠═╣║╣ ╠╦╝
    ╩ ╩╚═╝ ╩ ╩ ╩╚═╝╩╚═ (Distributed Feature Store)
    [/bold cyan]""")

    os.environ["RAY_ACCEL_ENV_VAR_OVERRIDE_ON_ZERO"] = "0"
    serve() 
