# Standard Libraries
import os
import numpy as np
from urllib.parse import urlparse
from typing import Any

# Third party Libraries
from dotenv import load_dotenv
from pyarrow import fs as pafs
from common.constants import VirtualDataset, DatasetConfig


# Loads env
load_dotenv()


class StorageUtils:
    @staticmethod
    def get_output_fs_and_path(base_output_uri: str, dataset_name: str) -> tuple[pafs.FileSystem | None, str, str]:
        output_fs = None

        if base_output_uri.startswith("s3://"):
            endpoint = os.getenv("FEATURE_STORE_MINIO_ENDPOINT", "http://127.0.0.1:9000")
            access_key = os.getenv("FEATURE_STORE_MINIO_ACCESS_KEY", "admin")
            secret_key = os.getenv("FEATURE_STORE_MINIO_SECRET_KEY", "password123")
            parsed_url = urlparse(endpoint)
            
            output_fs = pafs.S3FileSystem(
                access_key=access_key,
                secret_key=secret_key,
                endpoint_override=parsed_url.netloc,
                scheme=parsed_url.scheme,
            )

        scheme_prefix = base_output_uri.split("://")[DatasetConfig.HEAD_INDEX] + "://" if "://" in base_output_uri else ""
        clean_base = base_output_uri.replace(scheme_prefix, "") if scheme_prefix else base_output_uri

        if dataset_name in [VirtualDataset.DEFAULT_STRUCTURED, VirtualDataset.DEFAULT_UNSTRUCTURED]:
            clean_dataset_output = clean_base
            final_uri = base_output_uri
        else:
            clean_dataset_output = f"{clean_base.rstrip('/')}/{dataset_name}"
            final_uri = f"{base_output_uri.rstrip('/')}/{dataset_name}"

        return output_fs, clean_dataset_output, final_uri


class UDFResponseFormatter:
    @staticmethod
    def format_preview(raw_results: dict[str, list[dict]], input_columns_map: dict[str, set[str]]) -> dict[str, Any]:
        payload = {}
        for ds_name, rows in raw_results.items():
            input_cols = input_columns_map.get(ds_name, set())
            
            if not rows:
                payload[ds_name] = {"schema": [], "data": [], "preview_rows": 0}
                continue

            schema_info = []
            for col in rows[DatasetConfig.HEAD_INDEX].keys():
                val = rows[DatasetConfig.HEAD_INDEX][col]
                val_type = type(val).__name__

                if val_type == "ndarray" and hasattr(val, "shape"):
                    val_type = f"ndarray {val.shape}"
                elif val_type == "list":
                    val_type = f"list [{len(val)}]"

                schema_info.append({
                    "name": col,
                    "type": val_type,
                    "is_new": col not in input_cols
                })

                if isinstance(val, np.ndarray):
                    for r in rows:
                        if isinstance(r[col], np.ndarray):
                            r[col] = r[col].tolist()

            payload[ds_name] = {
                "schema": schema_info,
                "data": rows,
                "preview_rows": len(rows)
            }
            
        return payload
