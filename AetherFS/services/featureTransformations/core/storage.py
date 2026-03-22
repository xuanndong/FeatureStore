# Standard Libraries
import logging
from urllib.parse import urlparse
from datetime import datetime

# Third party Libraries
import fsspec
from fsspec.implementations.local import LocalFileSystem

# Logs
logger = logging.getLogger(__name__)


class FsspecClient:
    """
    Unified communication layer with storage systems (MinIO, S3, Local)
    """
    def __init__(self, uri: str, connection_options: dict = None):
        self.uri = uri
        self.parsed_uri = urlparse(uri)
        self.scheme = self.parsed_uri.scheme or "file"
        self.opts = connection_options or {}

        # Initialize the fsspec FileSystem object
        self.fs = self._initialize_fs()

    def _initialize_fs(self) -> LocalFileSystem:
        """
        Establish a connection based on the Scheme (s3, gs, file, etc.)
        """
        if self.scheme in ["s3", "s3a"]:
            # Configuration for MinIO/AWS S3
            return fsspec.filesystem(
                "s3",
                key=self.opts.get("access_key"),
                secret=self.opts.get("secret_key"),

                # Endpoint for MinIO
                client_kwargs={'endpoint_url': self.opts.get('endpoint_url')}
            )
        elif self.scheme == "file":
            return fsspec.filesystem("file")
        else:
            raise ValueError("The system does not yet support the storage protocol: %s", self.scheme)

    def get_raw_fs(self):
        """
        Returns the original filesystem object
        """
        return self.fs

    def is_directory(self, path: str = None) -> bool:
        """
        Check if the path is a file or a folder.
        """
        target_path = path or self.uri
        return self.fs.isdir(target_path)

    def list_files(self, path: str = None, recursive: bool = True) -> list[str]:
        """
        Get a list of all files in the directory.
        Ignore empty directories.
        """
        target_path = path or self.uri
        if not self.is_directory(target_path):
            return [target_path]

        # Use glob to recursively retrieve all files
        pattern = f"{target_path.rstrip('/')}/**" if recursive else f"{target_path.rstrip('/')}/*"
        all_paths = self.fs.glob(pattern)

        # Filter out folders, keeping only physical files
        files_only = [file_path for file_path in all_paths if not self.fs.isdir(file_path)]

        scheme_prefix = f"{self.scheme}://" if self.scheme != "file" else ""
        return [f"{scheme_prefix}{file_path}" if not file_path.startswith(scheme_prefix) else file_path for file_path in files_only]

    def get_modified_timestamp(self, path: str) -> float | None:
        """
        Get the last modified time of the file as Epoch float (seconds)
        """
        try:
            info = self.fs.info(path)
            mtime = info.get("mtime") # Usually returns a datetime object

            if isinstance(mtime, datetime):
                return mtime.timestamp()
            elif isinstance(mtime, (int, float)):
                return float(mtime)
            return None
        except Exception as e:
            logger.warning("Unable to retrieve metadata of %s: %s", path, e)
            return None

    def download_file(self, remote_path: str, local_path: str):
        """
        Download the file to your local machine
        """
        self.fs.get(remote_path, local_path)
        logger.info("Downloaded %s to %s", remote_path, local_path)
