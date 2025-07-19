import json
from datetime import datetime

class Order:
    """Defines how orders are represented locally and in MongoDB."""
    @staticmethod
    def serialize(data: dict) -> str:
        # add a timestamp if not present
        if "timestamp" not in data:
            data["timestamp"] = datetime.utcnow().isoformat()
        return json.dumps(data)

    @staticmethod
    def deserialize(raw: str) -> dict:
        return json.loads(raw)
