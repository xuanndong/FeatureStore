# Standard Libraries
import logging

# User Defined Libraries
from services.featureTransformations.core.storage import FsspecClient
from common.database.models import SourceFormat, ReadPolicies

# Third party Libraries
from pyarrow import dataset as ds


# Logs
logger = logging.getLogger(__name__)


class BatchReader:
    def __init__(self):
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
        policy: ReadPolicies = ReadPolicies.FULL_READ
    ) -> ds.Dataset | list[str] | None:
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

            scheme_prefix = f"{storage.scheme}://"
            clean_files = [path.replace(scheme_prefix, "") for path in valid_files]

            return ds.dataset(
                clean_files,
                filesystem=storage.get_raw_fs(),
                format=pyarrow_fmt
            )

        return valid_files
