# Standard Libraries
import logging
import os

# Local Libraries
from services.transformations.core.storage import FsspecClient
from common.constants import SourceFormat, ReadPolicies, VirtualTable, DatasetConfig

# Third party Libraries
from pyarrow import dataset as ds


# Logs
logger = logging.getLogger(__name__)


class BatchReader:
    def __init__(self):
        """
        Initialize
        """
        self.tabular_formats = {
            SourceFormat.CSV: "csv",
            SourceFormat.PARQUET: "parquet",
            SourceFormat.JSON: "json"
        }

    def load_data(
        self, 
        location_uri: str,
        source_format: SourceFormat,
        last_updated: float | None = None,
        connection_options: dict | None = None,
        policy: ReadPolicies = ReadPolicies.FULL_READ,
        partitioning: str | None = None,
        is_multi_file: bool = False
    ) -> ds.Dataset | list[str] | dict[str, ds.Dataset] | None:
        """
        Load data with optional partition tracking
        """
        logger.info("Scanning %s with policy %s", location_uri, policy)
        
        storage = FsspecClient(location_uri, connection_options)
        all_files = storage.list_files()

        if not all_files:
            logger.warning("No data found at %s", location_uri)
            return None

        if policy == ReadPolicies.FULL_READ or last_updated is None:
            valid_files = all_files
        else:
            valid_files = []
            for file_path in all_files:
                file_mtime = storage.get_modified_timestamp(file_path)

                if file_mtime is None or file_mtime > last_updated:
                    valid_files.append(file_path)

        if not valid_files:
            return None

        if source_format in self.tabular_formats:
            pyarrow_fmt = self.tabular_formats[source_format]
            raw_fs = storage.get_raw_fs()

            # Parse prefix
            scheme_prefix = f"{storage.scheme}://" if storage.scheme else ""
            clean_files = [path.replace(scheme_prefix, "") for path in valid_files] if scheme_prefix else valid_files

            if is_multi_file:
                datasets_dict = {}
                for file_path in clean_files:
                    table_name = os.path.splitext(os.path.basename(file_path))[DatasetConfig.HEAD_INDEX]

                    dataset_kwargs = {
                        "source": [file_path],
                        "filesystem": raw_fs,
                        "format": pyarrow_fmt
                    }
                    if partitioning:
                        dataset_kwargs["partitioning"] = partitioning
                        
                    datasets_dict[table_name] = ds.dataset(**dataset_kwargs)
                    
                return datasets_dict
            else:
                dataset_kwargs = {
                    "source": clean_files,
                    "filesystem": storage.get_raw_fs(),
                    "format": pyarrow_fmt
                }

                # Enable partition discovery
                if partitioning:
                    dataset_kwargs["partitioning"] = partitioning

                return ds.dataset(**dataset_kwargs)

        return valid_files

    def _extract_fields(self, dataset: ds.Dataset) -> list[dict]:
        """Retrieve dataset fields"""
        return [
            {"name": field.name, "type": str(field.type)}
            for field in dataset.schema
        ]

    def get_inventory(self, dataset: ds.Dataset | dict[str, ds.Dataset] | list[str] | None) -> list[dict]:
        """
        Extract a list of columns and data types for tabular
        """
        if dataset is None:
            return {}

        # Support for multi table (dictionary)
        if isinstance(dataset, dict):
            return {
                table_name: self._extract_fields(data)
                for table_name, data in dataset.items()
            }

        # Support for single table (dataset)
        if isinstance(dataset, ds.Dataset):
            return {VirtualTable.SOURCE_DATA.value: self._extract_fields(dataset)}

        return {}

    def get_dataset_stats(self, valid_files: list[str], storage: FsspecClient) -> dict:
        """
        Calculate dataset size (Bytes/MB) and total files
        """
        if not valid_files:
            return {
                "total_files": 0,
                "total_bytes": 0,
                "total_mb": 0
            }

        try:
            fs = storage.get_raw_fs()
            total_bytes = 0

            for file_path in valid_files:
                clean_path = file_path.replace(f"{storage.scheme}://", "")
                info = fs.info(clean_path)
                total_bytes += info.get('size', 0)

            return {
                "total_files": len(valid_files),
                "total_bytes": total_bytes,
                "total_mb": round(total_bytes / (1024 * 1024), 2)
            }
        except PermissionError as e:
            logger.error("Access denied: %s", e)
            raise PermissionError(f"Authentication failed or access denied: {str(e)}")
        except FileNotFoundError as e:
            logger.error("File disappeared during stats calculation: %s", e)
            raise FileNotFoundError(f"File not found: {str(e)}")
        except Exception as e:
            logger.error("System error retrieving storage capacity: %s", e)
            raise RuntimeError(f"Failed to connect to the storage system. Details: {str(e)}")
