# Standard Libraries
import logging
import os
import re

# Third party Libraries
import ray
from ray.exceptions import RayTaskError
from ray.data.datasource.partitioning import Partitioning
import pyarrow as pa
from pyarrow import dataset as ds
from pyarrow import csv as pacsv

# Local Libraries
from services.transformations.core.storage import FsspecClient
from services.transformations.materializers.offlineStore import OfflineStore
from services.transformations.core.wrapper import UDFEngine, RedisIngestion, find_udf_class_name
from common.constants import RayConfig, VirtualDataset, SourceFormat, DatasetConfig
from common.config import settings


# Logs
logger = logging.getLogger(__name__)


class RayBased:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(RayBased, cls).__new__(cls)
            cls._instance._initialize_ray()
        return cls._instance

    def _initialize_ray(self):
        """
        Initializes the Ray local cluster only if not already running
        """
        if ray.is_initialized():
            return

        logger.info("Initializing Ray Engine...")
        try:
            if settings.is_production and settings.RAY_CLUSTER_ADDRESS != "local":
                logger.info("[PRODUCTION] Connect to Ray Cluster: %s", settings.RAY_CLUSTER_ADDRESS)
                ray.init(address=settings.RAY_CLUSTER_ADDRESS, ignore_reinit_error=True)
            else:
                logger.info("[DEVELOPMENT] Ray Local Engine...")
                ray.init(
                    num_cpus=RayConfig.NUM_CPUS,
                    num_gpus=RayConfig.NUM_GPUS,
                    object_store_memory=RayConfig.MEMORY_BYTES,
                    ignore_reinit_error=True,
                    include_dashboard=False
                )
        except Exception as e:
            logger.error("Failed to initialize Ray Engine: %s", e)
            raise RuntimeError(f"Ray init failed: {str(e)}")

    def shutdown(self):
        """
        Safely terminates the Ray engine and cleans up resources
        """
        if not ray.is_initialized():
            return

        ray.shutdown()
        RayBased._instance = None
        logger.info("Ray Engine terminated.")

    def _get_single_dataset_name(self, dataset: ds.Dataset | pa.Table) -> str:
        """
        Automated dataset name extraction
        """
        if isinstance(dataset, ds.Dataset) and hasattr(dataset, "files") and len(dataset.files) == DatasetConfig.SINGLE_FILE_COUNT:
            return os.path.splitext(os.path.basename(dataset.files[DatasetConfig.HEAD_INDEX]))[DatasetConfig.HEAD_INDEX]
        return VirtualDataset.DEFAULT_STRUCTURED.value

    def preview_transform_structure(self, dataset: ds.Dataset | pa.Table | dict[str, ds.Dataset | pa.Table], udf_code: str, target_datasets: list[str] | None = None, requirements: list[str] | None = None, limit: int = 10) -> dict[str, list[dict]]:
        """
        Runs the UDF on a small sample of the dataset for quick feedback.
        """
        datasets_to_process = dataset if isinstance(dataset, dict) else {self._get_single_dataset_name(dataset): dataset}
        if not datasets_to_process:
            raise ValueError("Empty dataset mapping")

        detected_class = find_udf_class_name(udf_code)

        remote_args = {RayConfig.RUNTIME_ENV_KEY: {RayConfig.PIP_KEY: requirements}} if requirements else {}
        preview_results = {}

        for ds_name, data in datasets_to_process.items():
            if target_datasets and ds_name not in target_datasets:
                continue

            sample_table = data.head(limit) if isinstance(data, ds.Dataset) else data.slice(0, limit)

            if not sample_table.num_rows:
                preview_results[ds_name] = []
                continue

            ray_dataset = ray.data.from_arrow(sample_table)
            try:
                transformed = ray_dataset.map_batches(
                    UDFEngine,
                    fn_constructor_kwargs={"udf_code": udf_code, "class_name": detected_class, "dataset_name": ds_name},
                    batch_size=limit,
                    compute=ray.data.ActorPoolStrategy(size=1),
                    **remote_args
                )
                preview_results[ds_name] = transformed.take_all()
            except RayTaskError as e:
                logger.error("Worker crashed during preview on %s", ds_name)
                raise RuntimeError(f"UDF error on '{ds_name}': {str(e.cause)}")

        return preview_results

    def execute_udf_structure(self, dataset: ds.Dataset | dict[str, ds.Dataset], location_uri: str, udf_code: str, output_uri: str, source_format: SourceFormat, time_to_live: int, join_key: str, target_datasets: list[str] | None = None, requirements: list[str] | None = None, connection_options: dict | None = None, entity_keys: list[str] | None = None, sync_online: bool = False) -> dict[str, str]:
        """
        Executes the UDF across the entire dataset and writes the output to storage
        """
        datasets_to_process = dataset if isinstance(dataset, dict) else {self._get_single_dataset_name(dataset): dataset}
        if not datasets_to_process:
            raise ValueError("Empty dataset mapping")

        detected_class = find_udf_class_name(udf_code)

        remote_args = {RayConfig.RUNTIME_ENV_KEY: {RayConfig.PIP_KEY: requirements}} if requirements else {}

        client = FsspecClient(location_uri, connection_options)
        fs = client.get_raw_fs()

        saved_paths = {}
        offline_store = OfflineStore()

        for ds_name, data in datasets_to_process.items():
            if target_datasets and ds_name not in target_datasets:
                continue

            try:
                file_paths = data.files

                match source_format:
                    case SourceFormat.CSV:
                        parse_options = pacsv.ParseOptions(newlines_in_values=True)
                        ray_dataset = ray.data.read_csv(
                            file_paths, 
                            filesystem=fs, 
                            parse_options=parse_options
                        )
                    case SourceFormat.PARQUET:
                        ray_dataset = ray.data.read_parquet(file_paths, filesystem=fs)
                    case SourceFormat.JSON:
                        ray_dataset = ray.data.read_json(file_paths, filesystem=fs)
                    case _:
                        logger.warning(f"Fallback to from_arrow for format {source_format}")
                        ray_dataset = ray.data.from_arrow(data.to_table())

                transformed = ray_dataset.map_batches(
                    UDFEngine,
                    fn_constructor_kwargs={"udf_code": udf_code, "class_name": detected_class, "dataset_name": ds_name, "join_key": join_key},
                    compute=ray.data.ActorPoolStrategy(min_size=1, max_size=2),
                    batch_format="pyarrow",
                    **remote_args
                )

                if entity_keys and sync_online:
                    transformed = transformed.map_batches(
                        RedisIngestion,
                        fn_constructor_kwargs={"feature_group": ds_name, "entity_keys": entity_keys, "time_to_live": time_to_live},
                        batch_format="pyarrow",
                        compute=ray.data.ActorPoolStrategy(min_size=1, max_size=2),
                    )

                final_uri = offline_store.save_ray_dataset(dataset=transformed, output_uri=output_uri, dataset_name=ds_name)
                saved_paths[ds_name] = final_uri
            except RayTaskError as e:
                logger.error("Worker crashed during execution on %s", ds_name)
                raise RuntimeError(f"Execution error on '{ds_name}': {str(e.cause)}")

        return saved_paths

    def preview_transform_unstructure(self, dataset: list[str], location_uri: str, udf_code: str, source_format: SourceFormat, requirements: list[str] | None = None, connection_options: dict | None = None, limit: int = 1) -> dict[str, list[dict]]:
        """
        Runs the UDF on a small sample of unstructured data (Images, Text, Audio, etc.).
        """
        if not dataset:
            raise ValueError("Empty file list")

        client = FsspecClient(location_uri, connection_options)
        scheme_prefix = f"{client.scheme}://" if client.scheme else ""
        sample_paths = [p.replace(scheme_prefix, "") for p in dataset[:limit]] if scheme_prefix else dataset[:limit]
        ds_name = os.path.basename(location_uri.strip("/")) or VirtualDataset.DEFAULT_UNSTRUCTURED.value

        detected_class = find_udf_class_name(udf_code)

        full_sample_uris = dataset[:limit]
        fs = client.get_raw_fs()

        fn_kwargs = {
            "udf_code": udf_code,
            "class_name": detected_class,
            "dataset_name": ds_name
        }

        match source_format:
            case SourceFormat.IMAGE:
                ray_dataset = ray.data.read_images(sample_paths, filesystem=fs)

            case SourceFormat.TEXT:
                ray_dataset = ray.data.read_text(sample_paths, filesystem=fs)

            case SourceFormat.AUDIO | SourceFormat.VIDEO:
                items = [{"path": p} for p in full_sample_uris]
                ray_dataset = ray.data.from_items(items)

                fn_kwargs["connection_options"] = connection_options

            case SourceFormat.BINARY:
                ray_dataset = ray.data.read_binary_files(sample_paths, filesystem=fs)

            case _:
                raise ValueError(f"Unsupported format: '{source_format}'")

        remote_args = {RayConfig.RUNTIME_ENV_KEY: {RayConfig.PIP_KEY: requirements}} if requirements else {}

        try:
            transformed = ray_dataset.map_batches(
                UDFEngine,
                fn_constructor_kwargs=fn_kwargs,
                batch_size=limit,
                compute=ray.data.ActorPoolStrategy(size=1),
                **remote_args
            )
            return {ds_name: transformed.take_all()}
        except RayTaskError as e:
            logger.error("Worker crashed during unstructured preview.")
            raise RuntimeError(f"Preview error: {str(e.cause)}")

    def execute_udf_unstructure(self, dataset: list[str], location_uri: str, udf_code: str, output_uri: str, source_format: str, time_to_live: int, join_key: str, requirements: list[str] | None = None, connection_options: dict | None = None, entity_keys: list[str] | None = None, sync_online: bool = False) -> dict[str, str]:
        """
        Executes UDF across unstructured files and writes the output (usually as Parquet metadata/embeddings) to internal storage.
        """
        if not dataset:
            raise ValueError("Empty file list")

        client = FsspecClient(location_uri, connection_options)
        scheme_prefix = f"{client.scheme}://" if client.scheme else ""
        clean_paths = [p.replace(scheme_prefix, "") for p in dataset] if scheme_prefix else dataset
        ds_name = os.path.basename(location_uri.strip("/")) or VirtualDataset.DEFAULT_UNSTRUCTURED.value

        detected_class = find_udf_class_name(udf_code)

        fs = client.get_raw_fs()

        fn_kwargs = {
            "udf_code": udf_code,
            "class_name": detected_class,
            "dataset_name": ds_name,
            "join_key": join_key
        }

        # Join Key
        partition_strategy = Partitioning(style="hive", field_names=[join_key])

        match source_format:
            case SourceFormat.IMAGE:
                ray_dataset = ray.data.read_images(clean_paths, filesystem=fs, partitioning=partition_strategy)

            case SourceFormat.TEXT:
                ray_dataset = ray.data.read_text(clean_paths, filesystem=fs, partitioning=partition_strategy)

            case SourceFormat.AUDIO | SourceFormat.VIDEO:
                items = []
                for p in dataset:
                    item = {"path": p}

                    match_hive = re.search(rf"{join_key}=([^/]+)", p)
                    if match_hive:
                        item[join_key] = match_hive.group(1)

                    items.append(item)

                ray_dataset = ray.data.from_items(items)
                fn_kwargs["connection_options"] = connection_options

            case SourceFormat.BINARY:
                ray_dataset = ray.data.read_binary_files(clean_paths, filesystem=fs, partitioning=partition_strategy)

            case _:
                raise ValueError(f"Unsupported format: '{source_format}'")

        remote_args = {RayConfig.RUNTIME_ENV_KEY: {RayConfig.PIP_KEY: requirements}} if requirements else {}

        try:
            transformed = ray_dataset.map_batches(
                UDFEngine,
                fn_constructor_kwargs=fn_kwargs,
                compute=ray.data.ActorPoolStrategy(min_size=1, max_size=2),
                **remote_args
            )

            if entity_keys and sync_online:
                transformed = transformed.map_batches(
                    RedisIngestion,
                    fn_constructor_kwargs={"feature_group": ds_name, "entity_keys": entity_keys, "time_to_live": time_to_live},
                    batch_format="pyarrow",
                    compute=ray.data.ActorPoolStrategy(min_size=1, max_size=2)
                )

            offline_store = OfflineStore()
            final_uri = offline_store.save_ray_dataset(dataset=transformed, output_uri=output_uri, dataset_name=ds_name)

            return {ds_name: final_uri}
        except RayTaskError as e:
            logger.error("Worker crashed during unstructured execution.")
            raise RuntimeError(f"Execution error: {str(e.cause)}")

    def execute(
        self, 
        dataset: ds.Dataset | dict[str, ds.Dataset] | list[str], 
        location_uri: str, 
        udf_code: str, 
        output_uri: str, 
        source_format: str,
        join_key: str,
        time_to_live: int | None,
        requirements: list[str] | None = None, 
        connection_options: dict | None = None, 
        target_datasets: list[str] | None = None,
        entity_keys: list[str] | None = None,
        sync_online: bool = False
    ) -> dict[str, str]:
        """
        Automatically route data to structured or unstructured pipelines
        """
        time_to_live = time_to_live if time_to_live is not None else DatasetConfig.TIME_TO_LIVE

        if isinstance(dataset, list):
            return self.execute_udf_unstructure(
                dataset=dataset,
                location_uri=location_uri,
                udf_code=udf_code,
                output_uri=output_uri,
                source_format=source_format,
                time_to_live=time_to_live,
                join_key=join_key,
                requirements=requirements,
                connection_options=connection_options,
                entity_keys=entity_keys,
                sync_online=sync_online
            )
        elif isinstance(dataset, (ds.Dataset, dict)):
            return self.execute_udf_structure(
                dataset=dataset,
                location_uri=location_uri,
                udf_code=udf_code,
                output_uri=output_uri,
                source_format=source_format,
                time_to_live=time_to_live,
                join_key=join_key,
                target_datasets=target_datasets,
                requirements=requirements,
                connection_options=connection_options,
                entity_keys=entity_keys,
                sync_online=sync_online
            )
        else:
            raise TypeError(f"Unsupported dataset format: {type(dataset)}")
