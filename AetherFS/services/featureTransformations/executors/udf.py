# Standard Libraries
import logging
import os

# Third party Libraries
import ray
from ray.exceptions import RayTaskError
import pyarrow as pa
from pyarrow import dataset as ds

# User define Libraries
from services.featureTransformations.core.storage import FsspecClient
from services.featureTransformations.core.utils import StorageUtils
from services.featureTransformations.core.wrapper import UDFWrapper
from common.constants import UDFConstants, RayConfig, VirtualDataset, SourceFormat, DatasetConfig


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
        return VirtualDataset.DEFAULT_STRUCTURED

    def preview_transform_structure(self, dataset: ds.Dataset | pa.Table | dict[str, ds.Dataset | pa.Table], udf_code: str, requirements: list[str] | None = None, limit: int = 10) -> dict[str, list[dict]]:
        """
        Runs the UDF on a small sample of the dataset for quick feedback.
        """
        datasets_to_process = dataset if isinstance(dataset, dict) else {self._get_single_dataset_name(dataset): dataset}
        if not datasets_to_process:
            raise ValueError("Empty dataset mapping")

        remote_args = {RayConfig.RUNTIME_ENV_KEY: {RayConfig.PIP_KEY: requirements}} if requirements else {}
        preview_results = {}

        for ds_name, data in datasets_to_process.items():
            sample_table = data.head(limit) if isinstance(data, ds.Dataset) else data.slice(0, limit)

            if not sample_table.num_rows:
                preview_results[ds_name] = []
                continue

            ray_dataset = ray.data.from_arrow(sample_table)
            try:
                transformed = ray_dataset.map_batches(
                    UDFWrapper,
                    fn_constructor_kwargs={"udf_code": udf_code, "class_name": UDFConstants.DEFAULT_CLASS_NAME, "dataset_name": ds_name},
                    batch_size=limit,
                    compute=ray.data.ActorPoolStrategy(size=1),
                    **remote_args
                )
                preview_results[ds_name] = transformed.take_all()
            except RayTaskError as e:
                logger.error("Worker crashed during preview on %s", ds_name)
                raise RuntimeError(f"UDF error on '{ds_name}': {str(e.cause)}")

        return preview_results

    def execute_udf_structure(self, dataset: ds.Dataset | dict[str, ds.Dataset], location_uri: str, udf_code: str, output_uri: str, target_datasets: list[str] | None = None, requirements: list[str] | None = None, connection_options: dict | None = None) -> dict[str, str]:
        """
        Executes the UDF across the entire dataset and writes the output to storage
        """
        datasets_to_process = dataset if isinstance(dataset, dict) else {self._get_single_dataset_name(dataset): dataset}
        if not datasets_to_process:
            raise ValueError("Empty dataset mapping")

        remote_args = {RayConfig.RUNTIME_ENV_KEY: {RayConfig.PIP_KEY: requirements}} if requirements else {}
        input_fs = FsspecClient(location_uri, connection_options).get_raw_fs()

        saved_paths = {}

        for ds_name, data in datasets_to_process.items():
            if target_datasets and ds_name not in target_datasets:
                continue
            
            file_paths = getattr(data, "files", [])
            if not file_paths:
                continue
            
            ray_dataset = ray.data.read_parquet(file_paths, filesystem=input_fs)
            try:
                transformed = ray_dataset.map_batches(
                    UDFWrapper,
                    fn_constructor_kwargs={"udf_code": udf_code, "class_name": UDFConstants.DEFAULT_CLASS_NAME, "dataset_name": ds_name},
                    compute=ray.data.ActorPoolStrategy(min_size=1, max_size=2),
                    **remote_args
                )
                
                out_fs, clean_path, final_uri = StorageUtils.get_output_fs_and_path(output_uri, ds_name)
                transformed.write_parquet(clean_path, filesystem=out_fs)

                saved_paths[ds_name] = final_uri
            except RayTaskError as e:
                logger.error("Worker crashed during execution on %s", ds_name)
                raise RuntimeError(f"Execution error on '{ds_name}': {str(e.cause)}")

        return saved_paths

    def preview_transform_unstructure(self, dataset: list[str], location_uri: str, udf_code: str, source_format: str, requirements: list[str] | None = None, connection_options: dict | None = None, limit: int = 1) -> dict[str, list[dict]]:
        """
        Runs the UDF on a small sample of unstructured data (Images, Text, Audio, etc.).
        """
        if not dataset:
            raise ValueError("Empty file list")

        client = FsspecClient(location_uri, connection_options)
        scheme_prefix = f"{client.scheme}://" if client.scheme else ""
        sample_paths = [p.replace(scheme_prefix, "") for p in dataset[:limit]] if scheme_prefix else dataset[:limit]

        fmt = str(source_format).strip().upper()
        fs = client.get_raw_fs()

        match fmt:
            case SourceFormat.IMAGE:
                ray_dataset = ray.data.read_images(sample_paths, filesystem=fs)
            case SourceFormat.TEXT:
                ray_dataset = ray.data.read_text(sample_paths, filesystem=fs)
            case SourceFormat.AUDIO | SourceFormat.VIDEO | SourceFormat.BINARY:
                ray_dataset = ray.data.read_binary_files(sample_paths, filesystem=fs)
            case _:
                raise ValueError(f"Unsupported format: '{source_format}'")

        remote_args = {RayConfig.RUNTIME_ENV_KEY: {RayConfig.PIP_KEY: requirements}} if requirements else {}
        ds_name = os.path.basename(location_uri.strip("/")) or VirtualDataset.DEFAULT_UNSTRUCTURED

        try:
            transformed = ray_dataset.map_batches(
                UDFWrapper,
                fn_constructor_kwargs={"udf_code": udf_code, "class_name": UDFConstants.DEFAULT_CLASS_NAME, "dataset_name": ds_name},
                batch_size=limit,
                compute=ray.data.ActorPoolStrategy(size=1),
                **remote_args
            )
            return {ds_name: transformed.take_all()}
        except RayTaskError as e:
            logger.error("Worker crashed during unstructured preview.")
            raise RuntimeError(f"Preview error: {str(e.cause)}")

    def execute_udf_unstructure(self, dataset: list[str], location_uri: str, udf_code: str, output_uri: str, source_format: str, requirements: list[str] | None = None, connection_options: dict | None = None) -> dict[str, str]:
        """
        Executes UDF across unstructured files and writes the output (usually as Parquet metadata/embeddings) to internal storage.
        """
        if not dataset:
            raise ValueError("Empty file list")

        client = FsspecClient(location_uri, connection_options)
        scheme_prefix = f"{client.scheme}://" if client.scheme else ""
        clean_paths = [p.replace(scheme_prefix, "") for p in dataset] if scheme_prefix else dataset

        fmt = str(source_format).strip().upper()
        fs = client.get_raw_fs()

        match fmt:
            case SourceFormat.IMAGE:
                ray_dataset = ray.data.read_images(clean_paths, filesystem=fs)
            case SourceFormat.TEXT:
                ray_dataset = ray.data.read_text(clean_paths, filesystem=fs)
            case SourceFormat.AUDIO | SourceFormat.VIDEO | SourceFormat.BINARY:
                ray_dataset = ray.data.read_binary_files(clean_paths, filesystem=fs)
            case _:
                raise ValueError(f"Unsupported format: '{source_format}'")

        remote_args = {RayConfig.RUNTIME_ENV_KEY: {RayConfig.PIP_KEY: requirements}} if requirements else {}
        ds_name = os.path.basename(location_uri.strip("/")) or VirtualDataset.DEFAULT_UNSTRUCTURED

        try:
            transformed = ray_dataset.map_batches(
                UDFWrapper,
                fn_constructor_kwargs={"udf_code": udf_code, "class_name": UDFConstants.DEFAULT_CLASS_NAME, "dataset_name": ds_name},
                compute=ray.data.ActorPoolStrategy(min_size=1, max_size=2),
                **remote_args
            )
            
            out_fs, clean_path, final_uri = StorageUtils.get_output_fs_and_path(output_uri, ds_name)
            transformed.write_parquet(clean_path, filesystem=out_fs)
            
            return {ds_name: final_uri}
        except RayTaskError as e:
            logger.error("Worker crashed during unstructured execution.")
            raise RuntimeError(f"Execution error: {str(e.cause)}")
