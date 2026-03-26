# Standard Libraries
import logging
from typing import Any
from urllib.parse import urlparse
import os
from dotenv import load_dotenv

# Third party Libraries
import ray
from ray.exceptions import RayTaskError
import pyarrow as pa
from pyarrow import dataset as ds
from pyarrow import fs as pafs

# User define Libraries
from services.featureTransformations.core.storage import FsspecClient
from common.constants import UDFConstants, RayConfig, VirtualDataset, SourceFormat


# Logs
logger = logging.getLogger(__name__)

# Loads env
load_dotenv()


class RayBased:
    _instance = None

    def __new__(cls, *args, **kwargs):
        # Ensure only one instance is created
        if cls._instance is None:
            cls._instance = super(RayBased, cls).__new__(cls)
            cls._instance._initialize_ray()

        return cls._instance
    
    def _initialize_ray(self):
        """
        Initializes the Ray local cluster only if not already running
        """
        if ray.is_initialized():
            return None

        logger.info("Initializing Ray Engine (CPUs: %d, GPUs: %s, Object Store: %d bytes)...", RayConfig.NUM_CPUS, RayConfig.NUM_GPUS, RayConfig.MEMORY_BYTES)

        try:
            ray.init(
                num_cpus=RayConfig.NUM_CPUS,
                num_gpus=RayConfig.NUM_GPUS,
                object_store_memory=RayConfig.MEMORY_BYTES,
                ignore_reinit_error=True,
                include_dashboard=False
            )

            logger.info("Ray Engine initialized successfully")
        except Exception as e:
            logger.error("Failed to initialize Ray: %s", e)
            raise RuntimeError(f"Ray Engine startup failed: {str(e)}")

    def shutdown(self):
        """
        Safely terminates the Ray engine and cleans up resources
        """
        if ray.is_initialized():
            ray.shutdown()
            RayBased._instance = None
            logger.info("Ray Engine terminated successfully")

            return None

    def _save_transformed_data(self, transformed_dataset: ray.data.Dataset, base_output_uri: str, dataset_name: str) -> str:
        """
        Routing and storing the transformed dataset
        """
        output_fs = None

        if base_output_uri.startswith("s3://"):
            internal_endpoint = os.getenv("FEATURE_STORE_MINIO_ENDPOINT", "http://127.0.0.1:9000")
            internal_access_key = os.getenv("FEATURE_STORE_MINIO_ACCESS_KEY", "admin")
            internal_secret_key = os.getenv("FEATURE_STORE_MINIO_SECRET_KEY", "password123")

            parsed_url = urlparse(internal_endpoint)
            output_fs = pafs.S3FileSystem(
                access_key=internal_access_key,
                secret_key=internal_secret_key,
                endpoint_override=parsed_url.netloc,
                scheme=parsed_url.scheme,
            )

        scheme_prefix = ""
        if "://" in base_output_uri:
            scheme_prefix = base_output_uri.split("://")[0] + "://"

        clean_base_output = base_output_uri.replace(scheme_prefix, "") if scheme_prefix else base_output_uri

        if dataset_name in [VirtualDataset.DEFAULT_STRUCTURED, VirtualDataset.DEFAULT_UNSTRUCTURED]:
            clean_dataset_output = clean_base_output
            final_return_uri = base_output_uri
        else:
            clean_dataset_output = f"{clean_base_output.rstrip('/')}/{dataset_name}"
            final_return_uri = f"{base_output_uri.rstrip('/')}/{dataset_name}"

        transformed_dataset.write_parquet(
            clean_dataset_output,
            filesystem=output_fs
        )

        return final_return_uri

    def _get_single_dataset_name(self, dataset: ds.Dataset | pa.Table) -> str:
        """
        Automated dataset name extraction
        """
        if isinstance(dataset, ds.Dataset):
            files = dataset.files if hasattr(dataset, "files") else []

            if len(files) == 1:
                return os.path.splitext(os.path.basename(files[0]))[0]

        return VirtualDataset.DEFAULT_STRUCTURED

    def _compile_udf(self, udf_code: str, class_name: str = UDFConstants.DEFAULT_CLASS_NAME) -> Any:
        """
        Dynamically compiles user-provided Python code into an executable class
        """
        namespace = {}

        try:
            # Execute the code string in the shared namespace
            exec(udf_code, namespace)
        except SyntaxError as e:
            raise ValueError(f"Syntax error at line {str(e.lineno)}: {str(e.msg)}")
        except Exception as e:
            logger.error("UDF compilation error: %s", e)
            raise ValueError(f"Failed to compile UDF code: {str(e)}")

        if class_name not in namespace:
            raise ValueError(f"UDF code must contain a class named {class_name}")

        udf_class = namespace[class_name]

        if not hasattr(udf_class, UDFConstants.REQUIRED_METHOD):
            raise ValueError(f"Class '{class_name}' must implement '{UDFConstants.REQUIRED_METHOD}(self, batch)'")

        try:
            _ = udf_class(dataset_name="dummy_dataset")
        except TypeError as e:
            logger.error("Contract breach in UDF __init__: %s", e)
            raise ValueError(f"Class '{class_name}' must define")
        except Exception as e:
            logger.error("Error during UDF dummy initialization: %s", e)
            raise ValueError(f"Error initializing class '{class_name}': {e}")

        return udf_class

    def preview_transform_structure(self, dataset: ds.Dataset | pa.Table | dict[str, ds.Dataset | pa.Table], udf_code: str, requirements: list[str] | None = None, limit: int = 10) -> dict[str, list[dict]]:
        """
        Runs the UDF on a small sample of the dataset for quick feedback.
        """
        datasets_to_process = {}

        if isinstance(dataset, (ds.Dataset, pa.Table)):
            dataset_name = self._get_single_dataset_name(dataset)
            datasets_to_process = {dataset_name: dataset}
        elif isinstance(dataset, dict):
            datasets_to_process = dataset
        else:
            raise TypeError("Dataset must be a pyarrow.dataset.Dataset, pyarrow.Table, or a dict of them")

        if not datasets_to_process:
            raise ValueError("Cannot execute UDF on an empty dataset mapping")

        udf_class = self._compile_udf(udf_code)

        remote_args = {}
        if requirements:
            remote_args[RayConfig.RUNTIME_ENV_KEY] = {RayConfig.PIP_KEY: requirements}

        preview_results = {}

        for dataset_name, data in datasets_to_process.items():
            if isinstance(data, ds.Dataset):
                sample_table = data.head(limit)
            elif isinstance(data, pa.Table):
                sample_table = data.slice(0, limit)
            else:
                raise TypeError(f"Invalid data type for dataset '{dataset_name}'")

            if not sample_table.num_rows:
                preview_results[dataset_name] = []
                continue

            ray_dataset = ray.data.from_arrow(sample_table)

            try:
                transformed_dataset = ray_dataset.map_batches(
                    udf_class,
                    fn_constructor_kwargs={"dataset_name": dataset_name},
                    batch_size=limit,
                    compute=ray.data.ActorPoolStrategy(size=1),
                    **remote_args
                )

                preview_results[dataset_name] = transformed_dataset.take_all()
            except RayTaskError as e:
                logger.error("UDF execution crashed on Ray worker")
                raise RuntimeError(f"User logic error: {str(e.cause)}")
            except Exception as e:
                logger.error("System error during preview transformation: %s", e)
                raise RuntimeError(f"Preview transformation failed: {str(e)}")

        return preview_results

    def execute_udf_structure(self, dataset: ds.Dataset | dict[str, ds.Dataset], location_uri: str, udf_code: str, output_uri: str, target_datasets: list[str] | None = None, requirements: list[str] | None = None, connection_options: dict | None = None) -> dict[str, str]:
        """
        Executes the UDF across the entire dataset and writes the output to storage
        """
        datasets_to_process = {}

        if isinstance(dataset, ds.Dataset):
            dataset_name = self._get_single_dataset_name(dataset)
            datasets_to_process = {dataset_name: dataset}
        elif isinstance(dataset, dict):
            datasets_to_process = dataset
        else:
            raise TypeError("Dataset must be a pyarrow.dataset.Dataset or a dictionary of datasets")

        if not datasets_to_process:
            raise ValueError("Cannot execute UDF on an empty dataset mapping")

        udf_class = self._compile_udf(udf_code)

        remote_args = {}
        if requirements:
            remote_args[RayConfig.RUNTIME_ENV_KEY] = {RayConfig.PIP_KEY: requirements}

        input_storage_client = FsspecClient(location_uri, connection_options)
        input_fs = input_storage_client.get_raw_fs()

        saved_paths = {}

        for dataset_name, data in datasets_to_process.items():
            if target_datasets and dataset_name not in target_datasets:
                logger.info("Skipping dataset '%s' as it is not in target list.", dataset_name)
                continue

            file_paths = data.files if hasattr(data, "files") else []
            if not file_paths: continue

            ray_dataset = ray.data.read_parquet(
                file_paths,
                filesystem=input_fs
            )
            
            try:
                transformed_dataset = ray_dataset.map_batches(
                    udf_class,
                    fn_constructor_kwargs={"dataset_name": dataset_name},
                    compute=ray.data.ActorPoolStrategy(min_size=1, max_size=2),
                    **remote_args
                )

                final_uri = self._save_transformed_data(
                    transformed_dataset=transformed_dataset,
                    base_output_uri=output_uri,
                    dataset_name=dataset_name
                )

                saved_paths[dataset_name] = final_uri
            except RayTaskError as e:
                logger.error("UDF execution crashed on Ray worker for dataset %s", dataset_name)
                raise RuntimeError(f"User logic error on dataset '{dataset_name}': {str(e.cause)}")
            except Exception as e:
                logger.error("Error during full execution and saving for dataset %s: %s", dataset_name, e)
                raise RuntimeError(f"Full execution failed on dataset '{dataset_name}': {str(e)}")

        return saved_paths

    def preview_transform_unstructure(self, dataset: list[str], location_uri: str, udf_code: str, source_format: str, requirements: list[str] | None = None, connection_options: dict | None = None, limit: int = 1) -> dict[str, list[dict]]:
        """
        Runs the UDF on a small sample of unstructured data (Images, Text, Audio, etc.).
        """
        if not dataset:
            raise ValueError("Cannot execute UDF on an empty file list")

        input_storage_client = FsspecClient(location_uri, connection_options)
        input_fs = input_storage_client.get_raw_fs()

        scheme_prefix = f"{input_storage_client.scheme}://"
        sample_paths = [path.replace(scheme_prefix, "") for path in dataset[:limit]]

        fmt = str(source_format).strip().upper()
        
        match fmt:
            case SourceFormat.IMAGE:
                ray_dataset = ray.data.read_images(sample_paths, filesystem=input_fs)
            case SourceFormat.TEXT:
                ray_dataset = ray.data.read_text(sample_paths, filesystem=input_fs)
            case SourceFormat.AUDIO | SourceFormat.VIDEO | SourceFormat.BINARY:
                ray_dataset = ray.data.read_binary_files(sample_paths, filesystem=input_fs)
            case _:
                raise ValueError(f"Unsupported unstructured source format: '{source_format}'")

        udf_class = self._compile_udf(udf_code)

        remote_args = {}
        if requirements:
            remote_args[RayConfig.RUNTIME_ENV_KEY] = {RayConfig.PIP_KEY: requirements}

        try:
            dataset_name = os.path.basename(location_uri.strip("/"))
            if not dataset_name:
                dataset_name = VirtualDataset.DEFAULT_UNSTRUCTURED

            transformed_dataset = ray_dataset.map_batches(
                udf_class,
                fn_constructor_kwargs={"dataset_name": dataset_name},
                batch_size=limit,
                compute=ray.data.ActorPoolStrategy(size=1),
                **remote_args
            )

            return {dataset_name: transformed_dataset.take_all()}
        except RayTaskError as e:
            logger.error("UDF execution crashed on Ray worker")
            raise RuntimeError(f"User logic error: {str(e.cause)}")
        except Exception as e:
            logger.error("System error during unstructured preview transformation: %s", e)
            raise RuntimeError(f"Preview transformation failed: {str(e)}")

    def execute_udf_unstructure(self, dataset: list[str], location_uri: str, udf_code: str, output_uri: str, source_format: str, requirements: list[str] | None = None, connection_options: dict | None = None) -> dict[str, str]:
        """
        Executes UDF across unstructured files and writes the output (usually as Parquet metadata/embeddings) to internal storage.
        """
        if not dataset:
            raise ValueError("Cannot execute UDF on an empty file list")

        input_storage_client = FsspecClient(location_uri, connection_options)
        input_fs = input_storage_client.get_raw_fs()

        scheme_prefix = f"{input_storage_client.scheme}://"
        clean_paths = [path.replace(scheme_prefix, "") for path in dataset]

        fmt = str(source_format).strip().upper()

        match fmt:
            case SourceFormat.IMAGE:
                ray_dataset = ray.data.read_images(clean_paths, filesystem=input_fs)
            case SourceFormat.TEXT:
                ray_dataset = ray.data.read_text(clean_paths, filesystem=input_fs)
            case SourceFormat.AUDIO | SourceFormat.VIDEO | SourceFormat.BINARY:
                ray_dataset = ray.data.read_binary_files(clean_paths, filesystem=input_fs)
            case _:
                raise ValueError(f"Unsupported unstructured source format: '{source_format}'")

        udf_class = self._compile_udf(udf_code)

        remote_args = {}
        if requirements:
            remote_args[RayConfig.RUNTIME_ENV_KEY] = {RayConfig.PIP_KEY: requirements}

        dataset_name = os.path.basename(location_uri.strip("/"))
        if not dataset_name:
            dataset_name = VirtualDataset.DEFAULT_UNSTRUCTURED

        try:
            transformed_dataset = ray_dataset.map_batches(
                udf_class,
                fn_constructor_kwargs={"dataset_name": dataset_name},
                compute=ray.data.ActorPoolStrategy(min_size=1, max_size=2),
                **remote_args
            )

            final_uri = self._save_transformed_data(
                transformed_dataset=transformed_dataset,
                base_output_uri=output_uri,
                dataset_name=dataset_name
            )

            return {dataset_name: final_uri}
        except RayTaskError as e:
            logger.error("UDF execution crashed on Ray worker for unstructured data %s", dataset_name)
            raise RuntimeError(f"User logic error on dataset '{dataset_name}': {str(e.cause)}")
        except Exception as e:
            logger.error("Error during full execution for unstructured data %s: %s", dataset_name, e)
            raise RuntimeError(f"Full execution failed on dataset '{dataset_name}': {str(e)}")
