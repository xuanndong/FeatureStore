# Standard Libraries
import os
import shutil
import subprocess
import logging
from dataclasses import dataclass

# Logs
logger = logging.getLogger(__name__)


@dataclass
class SystemProfile:
    logical_cpus: int
    physical_gpus: int
    total_ram_bytes: int


class SystemUtils:
    """
    Utility class for system and hardware-level operations
    """
    _profile: SystemProfile | None = None

    @classmethod
    def get_profile(cls) -> SystemProfile:
        """
        Returns a complete system hardware profile
        """
        if cls._profile is not None:
            return cls._profile

        DEFAULT_CPU = 2
        cpus = os.cpu_count() or DEFAULT_CPU

        gpus = 0
        if shutil.which("nvidia-smi"):
            try:
                result = subprocess.run(
                    ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                    capture_output=True,
                    text=True,
                    check=True
                )
                gpus = len([line for line in result.stdout.split('\n') if line.strip()])
            except Exception as e:
                logger.warning("GPU scan failed: %s. Defaulting to 0", e)

        try:
            ram_bytes = os.sysconf('SC_PAGE_SIZE') * os.sysconf('SC_PHYS_PAGES')
        except (ValueError, AttributeError):
            ram_bytes = 4 * 1024 * 1024 * 1024  # Fallback to 4GB

        cls._profile = SystemProfile(
            logical_cpus=cpus,
            physical_gpus=gpus,
            total_ram_bytes=ram_bytes
        )

        logger.info("System Profile Loaded: %s", cls._profile)
        return cls._profile
