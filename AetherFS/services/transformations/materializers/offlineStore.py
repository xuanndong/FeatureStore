# Standard Libraries
import os
import posixpath
import logging
import json
import base64
from urllib.parse import urlparse

# Third party Libraries
import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow.compute as pc
from pyarrow import fs as pafs
import pandas as pd
import ray.data

# Local Libraries
from common.config import settings
from common.constants import VirtualDataset


# Logs
logger = logging.getLogger(__name__)


class OfflineStore:
    def _get_fs_and_base_path(self, uri: str) -> tuple[pafs.FileSystem, str]:
        """
        FileSystem Initialization and Path Preparation
        """
        parsed_uri = urlparse(uri)
        scheme = parsed_uri.scheme

        if scheme in ["s3", "s3a"]:
            parsed_endpoint = urlparse(settings.MINIO_ENDPOINT)
            fs = pafs.S3FileSystem(
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                endpoint_override=parsed_endpoint.netloc,
                scheme=parsed_endpoint.scheme,
            )
        elif scheme in ["file", ""]:
            fs = pafs.LocalFileSystem()
        else:
            raise ValueError(f"Storage protocol not supported: '{scheme}'")

        prefix = f"{scheme}://" if scheme else ""
        clean_path = uri.replace(prefix, "", 1)

        return fs, clean_path

    def _encode_bytes(self, obj):
        """
        Convert raw bytes to base64 for JSON serialization
        """
        if isinstance(obj, bytes):
            return base64.b64encode(obj).decode('utf-8')
        return obj

    def _extract_pa_metadata(self, table: pa.Table) -> dict:
        """
        Extract schema, sample data, and statistics from PyArrow Table
        """
        row_count = table.num_rows
        schema_meta = {name: str(type) for name, type in zip(table.schema.names, table.schema.types)}

        # Extract Sample Data (First 10 rows)
        sample_df = table.slice(0, min(10, row_count)).to_pandas()

        for col in sample_df.select_dtypes(include=['object', 'string']).columns:
            sample_df[col] = sample_df[col].apply(self._encode_bytes)
            
        sample_data = sample_df.to_dict(orient="records")

        # Extract Statistics
        stats = {}
        for col_name in table.column_names:
            col_data = table.column(col_name)
            null_count = pc.null_count(col_data).as_py()

            col_stats = {
                "null_count": null_count,
                "null_percentage": round((null_count / row_count) * 100, 2) if row_count > 0 else 0.0
            }

            # Numeric stats
            if pa.types.is_integer(col_data.type) or pa.types.is_floating(col_data.type):
                try:
                    col_stats["min"] = float(pc.min(col_data).as_py())
                    col_stats["max"] = float(pc.max(col_data).as_py())
                    col_stats["mean"] = float(pc.mean(col_data).as_py())
                except Exception:
                    pass

            stats[col_name] = col_stats

        return {
            "row_count": row_count,
            "schema": schema_meta,
            "sample_data": sample_data,
            "statistics": stats
        }

    def _write_summary(self, fs: pafs.FileSystem, summary_path: str, summary_data: dict):
        """
        Write summary JSON file to storage
        """
        if isinstance(fs, pafs.LocalFileSystem):
            os.makedirs(os.path.dirname(summary_path), exist_ok=True)

        with fs.open_output_stream(summary_path) as file:
            file.write(json.dumps(summary_data, default=str).encode('utf-8'))

    def save_pyarrow_table(self, table: pa.Table, output_uri: str, dataset_name: str) -> str:
        """
        Write single tabular data and generate summary metadata
        """
        fs, base_path = self._get_fs_and_base_path(output_uri)

        is_default = dataset_name in [VirtualDataset.DEFAULT_STRUCTURED.value, VirtualDataset.DEFAULT_UNSTRUCTURED.value]

        file_name = "data.parquet" if is_default else f"{dataset_name}.parquet"
        summary_name = "summary.json" if is_default else f"{dataset_name}_summary.json"

        target_path = posixpath.join(base_path, file_name)
        final_uri = posixpath.join(output_uri, file_name)

        summary_path = posixpath.join(base_path, summary_name)
        summary_uri = posixpath.join(output_uri, summary_name)

        if isinstance(fs, pafs.LocalFileSystem):
            os.makedirs(os.path.dirname(target_path), exist_ok=True)

        # Sink Parquet
        pq.write_table(table, target_path, filesystem=fs)

        # Sink Summary
        summary_data = self._extract_pa_metadata(table)
        self._write_summary(fs, summary_path, summary_data)

        logger.info(f"Successfully saved data and summary to {output_uri}")
        return {
            "dataset_name": dataset_name,
            "final_uri": final_uri,
            "summary_uri": summary_uri,
            "row_count": summary_data["row_count"]
        }

    def save_ray_dataset(self, dataset: ray.data.Dataset, output_uri: str, dataset_name: str) -> str:
        """
        Partitioned data write to multiple files and generate summary metadata
        """
        fs, base_path = self._get_fs_and_base_path(output_uri)

        is_default = dataset_name in [VirtualDataset.DEFAULT_STRUCTURED.value, VirtualDataset.DEFAULT_UNSTRUCTURED.value]
        dir_name = "" if is_default else dataset_name
        summary_name = "summary.json" if is_default else f"{dataset_name}_summary.json"

        target_dir = posixpath.join(base_path, dir_name)
        final_uri = posixpath.join(output_uri, dir_name)

        summary_path = posixpath.join(base_path, summary_name)
        summary_uri = posixpath.join(output_uri, summary_name)

        if isinstance(fs, pafs.LocalFileSystem):
            os.makedirs(target_dir, exist_ok=True)

        # Sink Parquet (Distributed)
        dataset.write_parquet(target_dir, filesystem=fs)

        # Extract Ray Metadata
        row_count = dataset.count()
        schema_meta = {name: str(type) for name, type in zip(dataset.schema().names, dataset.schema().types)}

        sample_df = dataset.limit(10).to_pandas()
        for col in sample_df.select_dtypes(include=['object', 'string']).columns:
            sample_df[col] = sample_df[col].apply(self._encode_bytes)

        summary_data = {
            "row_count": row_count,
            "schema": schema_meta,
            "sample_data": sample_df.to_dict(orient="records"),
            "statistics": {} # Advanced distributed stats can be added later
        }

        # Sink Summary
        self._write_summary(fs, summary_path, summary_data)

        logger.info(f"Successfully saved ray dataset and summary to {output_uri}")
        return {
            "dataset_name": dataset_name,
            "final_uri": final_uri,
            "summary_uri": summary_uri,
            "row_count": row_count
        }
