# Standard Libraries
import numpy as np
from typing import Any

# Third party Libraries
from common.constants import DatasetConfig


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


class AnalyticsTracker:
    """
    Data Collection Tool
    """
    def __init__(self):
        self.metrics = {"scalars": [], "charts": []}

    def log_scalar(self, name: str, value: float, unit: str = ""):
        self.metrics["scalars"].append({"name": name, "value": value, "unit": unit})

    def log_chart(self, chart_type: str, title: str, data: list, x_label: str = "x", y_label: str = "y"):
        self.metrics["charts"].append({
            "type": chart_type,
            "title": title,
            "x_label": x_label,
            "y_label": y_label,
            "data": data
        })

analytics = AnalyticsTracker()
