# Standard Libraries
import logging
from contextlib import contextmanager

# Third party Libraries
import duckdb
import pyarrow as pa
import pyarrow.dataset as ds

# Local Libraries
from common.constants import VirtualTable, DuckDBConfig


logger = logging.getLogger(__name__)


class AggregationBased:
    """
    Time-window aggregation engine for generating Point-in-Time correct features
    """
    def __init__(self, config: DuckDBConfig = DuckDBConfig()):
        self.memory_limit = config.MEMORY_LIMIT
        self.threads = config.THREADS

    def _parse_time_window(self, window: str) -> str:
        """
        Parses short window strings (e.g., '7d', '12h') into SQL INTERVAL syntax.
        """
        window = window.strip().lower()
        if not window:
            raise ValueError("Empty window format")

        val, unit = window[:-1], window[-1]

        match unit:
            case 'd':
                return f"INTERVAL {val} DAY"

            case 'h':
                return f"INTERVAL {val} HOUR"

            case 'm':
                return f"INTERVAL {val} MINUTE"

        raise ValueError(f"Unsupported window format: '{window}'. Use 'd', 'h', or 'm'.")

    def _build_aggregation_query(self, table_name: str, entity_keys: list[str], time_column: str, features: list[dict], windows: list[str]) -> str:
        """
        Dynamically generates a Point-in-Time correct SQL query with sliding windows
        """
        partition_clause = ", ".join(entity_keys)
        select_clauses = ["*"] # Select all original columns

        for window in windows:
            sql_interval = self._parse_time_window(window)

            for feature in features:
                col = feature.get("column")
                aggs = feature.get("aggregations", [])
                
                for agg in aggs:
                    agg_func = str(agg).upper()
                    if agg_func not in ["SUM", "AVG", "MIN", "MAX", "COUNT"]:
                        raise ValueError(f"Unsupported aggregation: {agg_func}")
                    
                    # Generate sliding window column, e.g., amount_sum_7d
                    new_col_name = f"{col}_{agg_func.lower()}_{window}"
                    
                    window_clause = (
                        f"{agg_func}({col}) OVER ("
                        f"PARTITION BY {partition_clause} "
                        f"ORDER BY {time_column} "
                        f"RANGE BETWEEN {sql_interval} PRECEDING AND CURRENT ROW"
                        f") AS {new_col_name}"
                    )
                    select_clauses.append(window_clause)

        select_sql = ",\n    ".join(select_clauses)
        return f"SELECT \n    {select_sql} \nFROM {table_name}"

    @contextmanager
    def execute(self, dataset: ds.Dataset | pa.Table, entity_keys: list[str], time_column: str, features: list[dict], windows: list[str], join_key: str | None = None, table_name: str = VirtualTable.SOURCE_DATA.value, limit: int | None = None):
        """
        Executes the generated aggregation query securely using DuckDB
        """
        if not entity_keys or not time_column or not features or not windows:
            raise ValueError("Missing required aggregation configurations (keys, time_column, features, windows)")

        con = duckdb.connect(database=':memory:')
        
        try:
            con.execute(f"PRAGMA memory_limit='{self.memory_limit}'")
            con.execute(f"PRAGMA threads={self.threads}")

            con.register(table_name, dataset)

            # Generate the complex SQL dynamically
            dynamic_sql = self._build_aggregation_query(table_name, entity_keys, time_column, features, windows)

            if limit:
                dynamic_sql = f"SELECT * FROM ({dynamic_sql}) LIMIT {limit}"

            logger.info("Executing Dynamic Aggregation Query")

            yield con.sql(dynamic_sql).arrow()
        except duckdb.BinderException as e:
            raise ValueError(f"Invalid column or table configuration: {str(e)}")
        except Exception as e:
            raise RuntimeError(f"Aggregation Engine Error: {str(e)}")
        finally:
            try:
                con.unregister(table_name)
            except Exception:
                pass
            con.close()
