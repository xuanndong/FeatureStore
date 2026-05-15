# Standard Libraries
import logging
import json
import concurrent.futures
import sys
import os
import time
import io
import threading

# Path processing
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "common", "grpc"))

# Third party Libraries
import grpc
from grpc_reflection.v1alpha import reflection
import ray
import psutil
import pyarrow as pa

# Generated Proto files
from common.grpc import featurePipeline_pb2 as pb2
from common.grpc import featurePipeline_pb2_grpc as pb2_grpc

# Local Libraries
from common.constants import TransformationType, ReadPolicies, SourceFormat, Materialization
from common.config import settings
from core.batchRunner import BatchPipelineRunner
from core.utils import analytics
from core import webhook
from services.transformations.executors.sqlBased import SQLBased
from services.transformations.executors.udf import find_udf_class_name, UDFEngine
from services.transformations.materializers.offlineStore import OfflineStore
from services.transformations.materializers.onlineStore import OnlineStore


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
        "analytics_json": json.dumps(analytics.metrics, default=str)
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
        logger.error(f"Data processing error for {feature_group_id}: {str(e)}")
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
        logger.error(f"View processing error for job {job_id}: {str(e)}", exc_info=True)

        webhook.report_job_status(
            webhook_url=webhook_url, 
            job_id=job_id, 
            status=Materialization.FAILED.value, 
            message=f"System Error: {str(e)}"
        )


@ray.remote
class AetherStreamingWorker:
    """
    Detached Ray Actor that consumes a Kafka topic, applies transformation per micro-batch,
    and sinks results to Offline Store (MinIO/Parquet) and/or Online Store (Redis).
    """

    def __init__(self, config: dict, transform_def: str, t_type: TransformationType):
        try:
            print("DEBUG: Entering AetherStreamingWorker.__init__", flush=True)
            self.config = config
            self.transform_def = transform_def
            self.t_type = t_type

            # Threading primitives — keeps actor responsive while loop runs in background
            self._stop_event = threading.Event()
            self._thread: threading.Thread | None = None

            # StreamReader
            print("DEBUG: Initializing StreamReader", flush=True)
            from services.transformations.loaders.streamReader import StreamReader
            stream_opts = {
                'bootstrap_servers': config['kafka_servers'],
                'group_id': f"aether_streaming_group_{config['fg_id']}",
                'auto_offset_reset': 'earliest',
            }
            self.stream_reader = StreamReader(
                connection_options=stream_opts,
                source_format=config.get('source_format')
            )

            print("DEBUG: Initializing OfflineStore", flush=True)
            self.offline_store = OfflineStore()
            self._online_store: OnlineStore | None = None

            # Transformation engine
            self.engine = None
            self.sql_query: str | None = None

            print(f"DEBUG: has_transformation={config.get('has_transformation')}, t_type={t_type}", flush=True)
            if config.get('has_transformation'):
                if t_type == TransformationType.SQL:
                    print("DEBUG: Initializing SQLBased", flush=True)
                    self.engine = SQLBased()
                    self.sql_query = transform_def

                elif t_type == TransformationType.PYTHON_UDF:
                    print("DEBUG: Finding UDF class name", flush=True)
                    class_name = find_udf_class_name(transform_def)
                    print(f"DEBUG: Found class name: {class_name}", flush=True)
                    if class_name:
                        print("DEBUG: Instantiating UDFEngine", flush=True)
                        self.engine = UDFEngine(
                            udf_code=transform_def,
                            class_name=class_name,
                            dataset_name=config['fg_name'],
                            join_key=config.get('join_key'),
                        )
                        print("DEBUG: UDFEngine instantiated successfully", flush=True)
                    else:
                        logger.error("Could not find UDF class with __call__. Transformation disabled.")

                elif t_type == TransformationType.AGGREGATION:
                    logger.warning(
                        "AGGREGATION transformation has limited semantics in micro-batch streaming: "
                        "window functions run per micro-batch, not across a continuous time axis. "
                        "Consider using a SQL transformation for streaming aggregations. "
                        "Raw data will be saved without transformation."
                    )

            # Micro-batch settings
            self.max_batch_size = 20
            self.flush_interval = 1.0  # seconds

            print(f"DEBUG: Streaming Worker initialized: FG={config['fg_id']}, topic={config['topic_name']}", flush=True)
            logger.info("Streaming Worker initialized: FG=%s, topic=%s", config['fg_id'], config['topic_name'])
        except Exception as e:
            import traceback
            print("CRITICAL ERROR IN AETHERSTREAMINGWORKER.__INIT__:", flush=True)
            traceback.print_exc()
            raise e

    @property
    def online_store(self) -> OnlineStore:
        """Lazy Redis connection — only created when actually needed."""
        if self._online_store is None:
            self._online_store = OnlineStore()
        return self._online_store

    # Public Actor Methods
    def start_streaming(self):
        """Spawn background thread and return immediately (non-blocking)."""
        if self._thread and self._thread.is_alive():
            logger.warning("Streaming thread already running for FG: %s", self.config['fg_id'])
            return

        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._loop,
            daemon=True,
            name=f"stream_{self.config['fg_id']}",
        )
        self._thread.start()
        logger.info("Streaming background thread started for FG: %s", self.config['fg_id'])

    def stop_streaming(self):
        """Signal the background thread to exit."""
        logger.info("Stop signal received for FG: %s", self.config['fg_id'])
        self._stop_event.set()

    # Internal Loop
    def _loop(self):
        """Main consume → transform → sink loop. Runs in background thread."""
        print(f"DEBUG: Listening on Kafka topic: {self.config['topic_name']}", flush=True)
        logger.info("Listening on Kafka topic: %s", self.config['topic_name'])

        try:
            for batch in self.stream_reader.consume_micro_batches(
                topic=self.config['topic_name'],
                batch_size=self.max_batch_size,
                timeout_sec=self.flush_interval,
                stop_event=self._stop_event
            ):
                print(f"DEBUG: Received a batch!", flush=True)
                try:
                    self._process_microbatch(batch)
                except Exception as e:
                    print(f"DEBUG: Error processing microbatch: {e}", flush=True)
                    logger.error("Error processing microbatch: %s", e, exc_info=True)
        except Exception as e:
            print(f"DEBUG: Streaming loop exited with error: {e}", flush=True)
            logger.error("Streaming loop exited with error: %s", e, exc_info=True)

        logger.info("Streaming loop exited cleanly for FG: %s", self.config['fg_id'])

    # Micro-batch Pipeline
    def _process_microbatch(self, input_table: pa.Table | dict):
        """Orchestrate: validate → transform → sink."""
        if input_table is None:
            return
        if isinstance(input_table, pa.Table) and input_table.num_rows == 0:
            return
        if isinstance(input_table, dict) and not input_table:
            return

        result_table = self._apply_transformation(input_table)
        if result_table is None or result_table.num_rows == 0:
            return

        self._sink(result_table)

    def _apply_transformation(self, table: pa.Table | dict) -> pa.Table | None:
        """Apply the configured transformation engine to the micro-batch."""
        if not self.config.get('has_transformation') or self.engine is None:
            if isinstance(table, dict):
                if "image" in table:
                    del table["image"]
                return pa.Table.from_pydict(table)
            return table  # No transformation — pass raw table through

        fg_name = self.config.get('fg_name', 'data')
        try:
            if self.t_type == TransformationType.SQL:
                with self.engine.execute(
                    dataset=table,
                    sql_query=self.sql_query,
                    table_name=fg_name,
                ) as result:
                    return result.read_all() if hasattr(result, 'read_all') else result

            elif self.t_type == TransformationType.PYTHON_UDF:
                raw = self.engine(table)  # UDFEngine accepts pa.Table
                # Normalize return value to pa.Table
                if isinstance(raw, pa.Table):
                    return raw
                if hasattr(raw, 'to_dict'):        # pandas fallback
                    if 'image' in raw.columns:
                        raw = raw.drop(columns=['image'])
                    return pa.Table.from_pandas(raw)
                if isinstance(raw, list):
                    for r in raw:
                        r.pop('image', None)
                    return pa.Table.from_pylist(raw)
                if isinstance(raw, dict):
                    raw.pop('image', None)
                    return pa.Table.from_pydict(raw)
                logger.warning("UDF returned unsupported type %s. Dropping result.", type(raw))
                return None

            # AGGREGATION: engine not instantiated for streaming — save raw table
            return table

        except Exception as e:
            logger.error("Transformation failed on micro-batch: %s", e, exc_info=True)
            return None

    def _sink(self, table: pa.Table):
        """Write the result table to Offline Store and/or Online Store."""
        fg_name = self.config.get('fg_name', 'data')
        output_uri = self.config.get('output_uri')
        entity_keys = self.config.get('entity_keys')
        sync_online = self.config.get('sync_online', False)

        if output_uri:
            print(f"DEBUG: Saving data to Offline Store: {output_uri}", flush=True)
            try:
                self.offline_store.save_pyarrow_table(
                    table=table,
                    output_uri=output_uri,
                    dataset_name=fg_name,
                    mode="append"
                )
            except Exception as e:
                logger.error("Offline store write failed: %s", e)

        if entity_keys and sync_online:
            try:
                self.online_store.upsert_pyarrow_table(
                    table=table,
                    feature_group=fg_name,
                    entity_keys=entity_keys,
                    time_to_live=self.config.get('time_to_live'),
                )
            except Exception as e:
                logger.error("Online store write failed: %s", e)


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
            "time_to_live": run_req.time_to_live if run_req.HasField('time_to_live') else None,
            "join_key": run_req.join_key
        }

    def PreviewFeatureGroup(self, request, context):
        logger.info(f"Received Preview request for URI: {request.location_uri}")
        try:
            conn_opts = self._parse_json_safe(request.connection_options_json)

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
                response.results_json[ds_name] = json.dumps(records, default=str)

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

            offline_store_creds = {
                "endpoint_url": settings.MINIO_ENDPOINT, 
                "access_key": settings.MINIO_ACCESS_KEY,
                "secret_key": settings.MINIO_SECRET_KEY
            }

            execute_view_materialization.remote(
                kwargs={
                    "join_key": request.join_key,
                    "feature_groups": feature_groups,
                    "output_uri": request.output_uri,
                    "connection_options": offline_store_creds
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

    def StartStreamingPipeline(self, request, context):
        logger.info("Received StartStreaming request for Feature Group: %s", request.fg_id)
        try:
            actor_name = f"stream_worker_{request.fg_id}"

            try:
                ray.get_actor(actor_name)
                return pb2.StreamingResponse(
                    success=True,
                    message="Streaming Worker is already running.",
                )
            except ValueError:
                pass  # Actor not found — create it

            config = {
                "fg_id": request.fg_id,
                "fg_name": request.fg_name,
                "topic_name": request.topic_name,
                "kafka_servers": request.kafka_servers,
                "join_key": request.join_key,
                "source_format": self._map_source_format(request.source_format),
                "has_transformation": request.has_transformation,
                "output_uri": request.output_uri,
                "entity_keys": list(request.entity_keys),
                "time_to_live": request.time_to_live if request.HasField("time_to_live") else None,
                "sync_online": request.sync_online,
            }
            t_type = self._map_transform_type(request.transformation_type)

            # Resolve the AetherFS root directory so Ray workers can import local modules
            _service_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            _grpc_root = os.path.join(_service_root, "common", "grpc")
            # Merge with existing PYTHONPATH so conda/system packages are not overridden
            _existing_pythonpath = os.environ.get("PYTHONPATH", "")
            _extra_paths = f"{_service_root}{os.pathsep}{_grpc_root}"
            _python_path = f"{_extra_paths}{os.pathsep}{_existing_pythonpath}" if _existing_pythonpath else _extra_paths

            worker = AetherStreamingWorker.options(
                name=actor_name,
                lifetime="detached",
                runtime_env={"env_vars": {"PYTHONPATH": _python_path}},
            ).remote(
                config=config,
                transform_def=request.transformation_definition,
                t_type=t_type,
            )

            worker.start_streaming.remote()

            return pb2.StreamingResponse(
                success=True,
                message=f"Streaming worker spawned as detached Ray actor: {actor_name}",
            )
        except Exception as e:
            logger.error("Failed to start streaming pipeline: %s", e, exc_info=True)
            context.abort(grpc.StatusCode.INTERNAL, str(e))

    def StopStreamingPipeline(self, request, context):
        logger.info("Received StopStreaming request for Feature Group: %s", request.fg_id)
        try:
            actor_name = f"stream_worker_{request.fg_id}"

            try:
                worker = ray.get_actor(actor_name)

                ray.get(worker.stop_streaming.remote(), timeout=5)
                ray.kill(worker, no_restart=True)
                logger.info("Streaming actor stopped and killed: %s", actor_name)
            except ValueError:
                logger.warning("Actor %s not found — already stopped.", actor_name)
            except Exception as e:
                logger.warning("Graceful stop failed (%s), force-killing actor.", e)
                try:
                    ray.kill(ray.get_actor(actor_name), no_restart=True)
                except Exception:
                    pass

            return pb2.StreamingResponse(
                success=True,
                message="Streaming pipeline stopped and resources cleared.",
            )
        except Exception as e:
            logger.error("Failed to stop streaming pipeline: %s", e, exc_info=True)
            context.abort(grpc.StatusCode.INTERNAL, str(e))


def serve():
    instance = FeaturePipelineAPI()

    server = grpc.server(concurrent.futures.ThreadPoolExecutor(max_workers=10))
    pb2_grpc.add_PipelineServiceServicer_to_server(instance, server)

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
