# Standard Libraries
import logging
from contextlib import contextmanager

# Third party Libraries
import pyarrow as pa

# Local Libraries
from common.constants import SourceFormat
from services.transformations.loaders.batchReader import BatchReader
from services.transformations.executors.sqlBased import SQLBased


logger = logging.getLogger(__name__)


class FeatureViewMaterializer:
    """
    Feature Merging
    """
    def __init__(self, sql_engine: SQLBased):
        self.sql_engine = sql_engine

    def _build_view_query(self, join_key: str, feature_groups: list[dict]) -> str:
        """
        Construct a dynamic LEFT JOIN statement based on a list of Feature Groups
        """
        base_alias = feature_groups[0]["alias"]
        select_cols = [f"{base_alias}.{join_key}"]

        for fg in feature_groups:
            for feat in fg["features"]:
                if feat == join_key:
                    continue
                select_cols.append(f"{fg['alias']}.{feat}")

        select_clause = ",\n    ".join(select_cols)
        sql_query = f"SELECT\n    {select_clause}\nFROM {base_alias}\n"

        for fg in feature_groups[1:]:
            alias = fg['alias']
            sql_query += f"LEFT JOIN {alias} ON {base_alias}.{join_key} = {alias}.{join_key}\n"

        return sql_query

    @contextmanager
    def execute(self, datasets_dict: dict, join_key: str, feature_groups: list[dict]) -> pa.Table:
        """
        Perform the join and return a context manager for the resulting dataset
        """
        if not feature_groups or not datasets_dict:
            raise ValueError("Missing feature groups or datasets for materialization")

        sql_query = self._build_view_query(join_key, feature_groups)
        logger.info(f"Executing Feature View JOIN query:\n{sql_query}")

        with self.sql_engine.execute(
            dataset=datasets_dict,
            sql_query=sql_query,
            join_key=join_key,
            table_name="feature_view_temp"
        ) as result_data:
            yield result_data
