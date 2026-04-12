# Standard Libraries
import logging

# Third party Libraries
import httpx


logger = logging.getLogger(__name__)


def report_status(webhook_url: str, feature_group_id: str, status: str, message: str):
    if not webhook_url: return

    payload = {
        "feature_group_id": feature_group_id,
        "status": status,
        "message": message
    }

    try:
        response = httpx.post(webhook_url, json=payload, timeout=5.0)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"[Webhook] Failed to report {status} for {feature_group_id}: {e}")
