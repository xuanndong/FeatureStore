# Standard Libraries
import logging
import base64

# Third party Libraries
import pyarrow.dataset as ds

# Local Libraries
from services.transformations.loaders.batchReader import BatchReader
from services.transformations.executors.sqlBased import SQLBased
from services.transformations.executors.udf import RayBased
from services.transformations.executors.batchAggregations import AggregationBased
from services.transformations.materializers.offlineStore import OfflineStore
from services.transformations.materializers.onlineStore import OnlineStore
from services.transformations.core.materialization import FeatureViewMaterializer
from services.transformations.core.storage import FsspecClient
from common.constants import TransformationType, ReadPolicies, SourceFormat, VirtualTable


# Logs
logger = logging.getLogger(__name__)


class BatchPipelineRunner:
    """
    Batch Flow Coordination: Extract data from Storage -> Process dataset -> Sink back to Storage
    """
    def __init__(self):
        self.batch_reader = BatchReader()
        self.sql_engine = SQLBased()
        self.agg_engine = AggregationBased()
        self.offline_store = OfflineStore()
        self.online_store = OnlineStore()

    @property
    def udf_engine(self):
        """
        Lazy Init
        """
        if not hasattr(self, '_udf_engine'):
            self._udf_engine = RayBased()
        return self._udf_engine

    @property
    def view_materializer(self):
        """
        Lazy Init for Feature View Materializer
        """
        if not hasattr(self, '_view_materializer'):
            self._view_materializer = FeatureViewMaterializer(sql_engine=self.sql_engine)
        return self._view_materializer

    def _format_preview_table(self, table) -> list[dict]:
        """
        Format pyarrow slice to json-safe dicts
        """
        df = table.to_pandas()
        for col in df.select_dtypes(include=['object', 'string']).columns:
            df[col] = df[col].apply(lambda x: base64.b64encode(x).decode('utf-8') if isinstance(x, bytes) else x)

        return df.to_dict('records')

    def _format_preview_dicts(self, records: list[dict]) -> list[dict]:
        """
        Format raw bytes in dictionaries are base64 encoded for JSON response
        """
        formatted_records = []

        for row in records:
            clean_row = {}
            for key, value in row.items():
                if isinstance(value, bytes):
                    clean_row[key] = base64.b64encode(value).decode('utf-8')
                else:
                    clean_row[key] = value
            formatted_records.append(clean_row)

        return formatted_records

    def preview(
        self,
        location_uri: str,
        source_format: SourceFormat,
        transform_type: TransformationType,
        transform_definition: str,
        connection_options: dict | None = None,
        target_datasets: list[str] | None = None,
        requirements: list[str] | None = None, 
        entity_keys: list[str] | None = None,
        time_column: str | None = None,
        features_config: list[dict] | None = None,
        windows: list[str] | None = None,
        limit: int = 10
    ) -> dict[str, list[dict]]:
        """
        Extract small sample -> Process -> Return JSON (No Storage Sink)
        """
        dataset_object = self.batch_reader.load_data(
            location_uri=location_uri,
            source_format=source_format,
            connection_options=connection_options,
            policy=ReadPolicies.FULL_READ # Always full read for preview to ensure data is found
        )

        if not dataset_object:
            return {}

        match transform_type:
            case TransformationType.PYTHON_UDF:
                if isinstance(dataset_object, list):
                    raw_results = self.udf_engine.preview_transform_unstructure(
                        dataset=dataset_object,
                        location_uri=location_uri, 
                        udf_code=transform_definition,
                        requirements=requirements,
                        source_format=source_format,
                        connection_options=connection_options,
                        limit=limit
                    )
                else:
                    raw_results = self.udf_engine.preview_transform_structure(
                        dataset=dataset_object,
                        udf_code=transform_definition,
                        target_datasets=target_datasets,
                        requirements=requirements,
                        limit=limit
                    )

                return {
                    ds_name: self._format_preview_dicts(records) for ds_name, records in raw_results.items()
                }

            case TransformationType.SQL:
                datasets_to_process = dataset_object if isinstance(dataset_object, dict) else { VirtualTable.SOURCE_DATA.value: dataset_object }
                preview_results = {}

                for ds_name, data in datasets_to_process.items():
                    with self.sql_engine.execute(
                        dataset=data,
                        sql_query=transform_definition,
                        table_name=ds_name,
                        limit=limit
                    ) as result_data:
                        result_table = result_data.read_all() if hasattr(result_data, 'read_all') else result_data
                        preview_results[ds_name] = self._format_preview_table(result_table)

                return preview_results

            case TransformationType.AGGREGATION:
                datasets_to_process = dataset_object if isinstance(dataset_object, dict) else { VirtualTable.SOURCE_DATA.value: dataset_object }
                preview_results = {}
                for ds_name, data in datasets_to_process.items():
                    with self.agg_engine.execute(
                        dataset=data,
                        entity_keys=entity_keys,
                        time_column=time_column,
                        features=features_config,
                        windows=windows,
                        table_name=ds_name,
                        limit=limit
                    ) as result_data:
                        result_table = result_data.read_all() if hasattr(result_data, 'read_all') else result_data
                        preview_results[ds_name] = self._format_preview_table(result_table)
                
                return preview_results
            
            case _:
                raise ValueError(f"Invalid transformation type: {transform_type}")

    def run(
        self,
        location_uri: str,
        output_uri: str,
        source_format: SourceFormat,
        transform_type: TransformationType,
        transform_definition: str,
        connection_options: dict | None = None,
        requirements: list[str] | None = None,
        target_datasets: list[str] | None = None,
        last_updated: float | None = None,
        read_policy: ReadPolicies = ReadPolicies.NEW_VALUES,
        entity_keys: list[str] | None = None,
        time_column: str | None = None,
        features_config: list[dict] | None = None,
        windows: list[str] | None = None,
        sync_online: bool = False,
        time_to_live: int | None = None,
        join_key: str | None = None
    ) -> dict[str, str]:
        """
        Start pipeline
        """
        dataset_object = self.batch_reader.load_data(
            location_uri=location_uri,
            source_format=source_format,
            last_updated=last_updated,
            connection_options=connection_options,
            policy=read_policy
        )

        if not dataset_object:
            logger.info("No data to process")
            return {}

        mode = "append" if read_policy == ReadPolicies.NEW_VALUES else "overwrite"

        match transform_type:
            case TransformationType.PYTHON_UDF:
                # Save Offline Storage
                return self.udf_engine.execute(
                    dataset=dataset_object,
                    location_uri=location_uri,
                    udf_code=transform_definition,
                    output_uri=output_uri,
                    source_format=source_format,
                    join_key=join_key,
                    time_to_live=time_to_live,
                    requirements=requirements,
                    connection_options=connection_options,
                    target_datasets=target_datasets,
                    entity_keys=entity_keys,
                    sync_online=sync_online,
                    mode=mode
                )

            case TransformationType.SQL:
                if isinstance(dataset_object, list):
                    raise ValueError("SQL Transformation only supports structured tabular data")

                datasets_to_process = dataset_object if isinstance(dataset_object, dict) else { VirtualTable.SOURCE_DATA.value: dataset_object }
                saved_metadata = {}

                for ds_name, data in datasets_to_process.items():
                    with self.sql_engine.execute(
                        dataset=data,
                        sql_query=transform_definition,
                        join_key=join_key,
                        table_name=ds_name,
                    ) as result_data:
                        result_table = result_data.read_all() if hasattr(result_data, 'read_all') else result_data

                        # Save Offline Storage
                        saved_metadata[ds_name] = self.offline_store.save_pyarrow_table(result_table, output_uri, ds_name, mode=mode)

                        # Save to Online Storage for Real-time Inference
                        if not entity_keys or not sync_online: continue

                        self.online_store.upsert_pyarrow_table(
                            table=result_table,
                            feature_group=ds_name,
                            entity_keys=entity_keys,
                            time_to_live=time_to_live
                        )

                return saved_metadata

            case TransformationType.AGGREGATION:
                if isinstance(dataset_object, list):
                    raise ValueError("Aggregation only supports structured tabular data")

                datasets_to_process = dataset_object if isinstance(dataset_object, dict) else { VirtualTable.SOURCE_DATA.value: dataset_object }
                saved_metadata = {}

                for ds_name, data in datasets_to_process.items():
                    with self.agg_engine.execute(
                        dataset=data,
                        entity_keys=entity_keys,
                        time_column=time_column,
                        features=features_config,
                        join_key=join_key,
                        windows=windows,
                        table_name=ds_name
                    ) as result_data:
                        result_table = result_data.read_all() if hasattr(result_data, 'read_all') else result_data

                        # Save Offline Storage
                        saved_metadata[ds_name] = self.offline_store.save_pyarrow_table(result_table, output_uri, ds_name, mode=mode)

                        # Save to Online Storage for Real-time Inference
                        if not entity_keys or not sync_online: continue

                        self.online_store.upsert_pyarrow_table(
                            table=result_table,
                            feature_group=ds_name,
                            entity_keys=entity_keys,
                            time_to_live=time_to_live
                        )

                return saved_metadata

            case _:
                raise ValueError(f"Invalid transformation type: {transform_type}")

    def _load_view_datasets(self, feature_groups: list[dict], connection_options: dict | None) -> dict:
        """
        Read data from the storage system
        """
        datasets_dict = {}

        for fg in feature_groups:
            alias = fg["alias"]
            location = fg["location_uri"]

            storage = FsspecClient(uri=location, connection_options=connection_options)
            raw_fs = storage.get_raw_fs()

            scheme_prefix = f"{storage.scheme}://" if storage.scheme else ""
            base_path = location.replace(scheme_prefix, "").rstrip("/")
            search_pattern = f"{base_path}/**/*.parquet"

            parquet_files = raw_fs.glob(search_pattern)
            if not parquet_files:
                raise ValueError(f"No Parquet data found for Feature Group '{alias}' at {location}")

            dataset = ds.dataset(
                source=parquet_files,
                filesystem=raw_fs,
                format=ds.ParquetFileFormat()
            )
            
            datasets_dict[alias] = dataset

        return datasets_dict

    def run_view(
        self, 
        join_key: str, 
        feature_groups: list[dict], 
        output_uri: str,
        connection_options: dict | None = None
    ) -> dict[str, str | int]:
        """
        Orchestrate the Materialization workflow for Feature View
        """
        if not feature_groups:
            logger.warning("No Feature Groups provided. Aborting materialization.")
            return {}

        datasets_to_process = self._load_view_datasets(feature_groups, connection_options)

        with self.view_materializer.execute(
            datasets_dict=datasets_to_process, 
            join_key=join_key, 
            feature_groups=feature_groups
        ) as result_data:
            
            result_table = result_data.read_all() if hasattr(result_data, 'read_all') else result_data

            # Offline Store
            saved_metadata = self.offline_store.save_pyarrow_table(
                table=result_table, 
                output_uri=output_uri, 
                dataset_name="data" 
            )

            return saved_metadata
