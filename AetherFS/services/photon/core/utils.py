# Standard Libraries
import os
import re
import asyncio
import hashlib
import calendar
from urllib.parse import urlparse
from typing import Any
from datetime import datetime, timezone, timedelta

# Third party Libraries
import s3fs

# Local Libraries
from common.constants import ScheduleInterval


async def verify_connection(uri: str, options: dict | None = None) -> tuple[bool, str]:
    """
    Check data source accessibility
    """
    # Check local path
    if uri.startswith("file://") or uri.startswith("/") or uri.startswith("./"):
        path = uri.replace("file://", "")

        exists = await asyncio.to_thread(os.path.exists, path)
        if not exists:
            return False, f"Local path does not exist: {path}"

        readable = await asyncio.to_thread(os.access, path, os.R_OK)
        if not readable:
            return False, f"Read permission denied at: {path}"
        
        return True, "Local Storage connected successfully"
    
    elif uri.startswith("s3://"):
        if not options:
            return False, "Connection options for MinIO/S3 are missing"

        parsed = urlparse(uri)
        bucket = parsed.netloc

        try:
            fs = s3fs.S3FileSystem(
                key=options.get("access_key"),
                secret=options.get("secret_key"),
                client_kwargs={
                    "endpoint_url": options.get("endpoint_url"),
                    "region_name": options.get("region", "us-east-1")
                },
                asynchronous=True
            )

            await fs._info(bucket)

            return True, f"Connection successful for bucket: {bucket}"
        except (FileNotFoundError, Exception) as e:
            error_msg = str(e)
            if "Forbidden" in error_msg or "403" in error_msg:
                return False, "Authentication failed: Incorrect access key or secret key"
            return False, f"Connection error: {error_msg}"

    return False, f"Unsupported URI protocol for validation: {uri}"


def infer_features_from_records(records: list[dict[str, Any]]) -> list[dict[str, str]]:
    if not records:
        return []

    inferred_features = []
    first_row = records[0]

    for key, value in first_row.items():
        data_type = type(value).__name__

        inferred_features.append({
            "name": key,
            "data_type": data_type,
        })

    return inferred_features


def calculate_next_run(interval: str, from_time: datetime = None) -> float:
    if not from_time:
        from_time = datetime.now(timezone.utc)
    
    match interval:
        case ScheduleInterval.HOURLY:
            next_time = from_time + timedelta(hours=1)
        case ScheduleInterval.DAILY:
            next_time = from_time + timedelta(days=1)
        case ScheduleInterval.WEEKLY:
            next_time = from_time + timedelta(weeks=1)
        case ScheduleInterval.MONTHLY | ScheduleInterval.QUARTERLY:
            months_to_add = 1 if interval == ScheduleInterval.MONTHLY else 3
            month = from_time.month - 1 + months_to_add
            year = from_time.year + month // 12
            month = month % 12 + 1
            day = min(from_time.day, calendar.monthrange(year, month)[1])

            next_time = from_time.replace(year=year, month=month, day=day)
        case _:
            return None

    return next_time.timestamp()


def generate_strict_hash(t_type: str, definition: str, features: list, requirements: list[str] = None) -> str:
    clean_code = re.sub(r'\s+', '', definition)

    feature_strings = [f"{f.name}:{f.data_type}" for f in features]
    feature_strings.sort() 
    clean_features = ",".join(feature_strings)

    req_string = ",".join(requirements) if requirements else ""

    raw_content = f"{t_type}|{clean_code}|{clean_features}|{req_string}"

    return hashlib.sha256(raw_content.encode('utf-8')).hexdigest()


def generate_producer_snippet(topic_name: str) -> str:
    return f"""
from confluent_kafka import Producer
import json

producer = Producer({{'bootstrap.servers': 'YOUR_PUBLIC_KAFKA_IP:9092'}})

def send_realtime_feature(data: dict):
    producer.produce(
        topic='{topic_name}',
        value=json.dumps(data).encode('utf-8')
    )
    producer.poll(0)
    """
