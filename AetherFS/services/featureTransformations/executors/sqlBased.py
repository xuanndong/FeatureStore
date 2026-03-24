# Standard Libraries
import logging
import re
from contextlib import contextmanager

# Third party Libraries
import duckdb
import pyarrow as pa
import pyarrow.dataset as ds

# User define Libraries
from common.constants import VirtualTable, DuckDBConfig


# Logs
logger = logging.getLogger(__name__)


class SQLBased:
    def __init__(self, config: DuckDBConfig = DuckDBConfig()):
        """
        Initialize
        """
        self.memory_limit = config.memory_limit
        self.threads = config.threads

        # SQL Reserved Keywords
        self.forbidden_keywords = {
            "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
            "CREATE", "COPY", "INSTALL", "LOAD", "ATTACH", "DETACH"
        }

    def _validate_sql_safety(self, sql_query: str):
        """
        Validate sql query
        """
        if not sql_query or not sql_query.strip():
            raise ValueError("Empty SQL statement")

        # Remove SQL comments
        clean_query = re.sub(r'--.*', '', sql_query)
        clean_query = re.sub(r'/\*.*?\*/', '', clean_query, flags=re.DOTALL)

        # Convert to uppercase and tokenize into keywords
        tokens = set(re.findall(r'\b[A-Z]+\b', clean_query.upper()))

        violations = self.forbidden_keywords.intersection(tokens)
        if violations:
            raise PermissionError("Access Denied: The following SQL commands are restricted: %s", violations)

    @contextmanager
    def execute(
        self,
        dataset: ds.Dataset | pa.Table | dict[str, ds.Dataset],
        sql_query: str,
        table_name: VirtualTable = VirtualTable.SOURCE_DATA
    ) -> pa.Table:
        """
        Execute sql query
        """

        # Security
        self._validate_sql_safety(sql_query)

        con = duckdb.connect(database=':memory:')
        registered_tables = [] # Track table list for unregistration

        try:
            con.execute(f"PRAGMA memory_limit='{self.memory_limit}'")
            con.execute(f"PRAGMA threads={self.threads}")

            if isinstance(dataset, dict):
                for name, data in dataset.items():
                    con.register(name, data)
                    registered_tables.append(name)
            else:
                con.register(table_name, dataset)
                registered_tables.append(table_name)

            yield con.sql(sql_query).arrow()
        except duckdb.ParserException as e:
            raise ValueError("SQL Syntax Error: %s", e)
        except duckdb.BinderException as e:
            raise ValueError("Undefined table or column: '%s'. Details: %s", table_name, e)
        except Exception as e:
            raise RuntimeError("Failed to execute SQL query: %s", e)
        finally:
            for table in registered_tables:
                try:
                    con.unregister(table)
                except Exception as e:
                    logger.error("Error: %s", e)

            con.close()
