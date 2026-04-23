# Third party Libraries
from pydantic import BaseModel


class OnlineQueryRequest(BaseModel):
    entity_name: str  # eg: "User", "Merchant"
    record_id: str    # eg: "user_9921"
