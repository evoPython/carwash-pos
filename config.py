import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class Config:
    # SQLite local DB path
    SQLITE_DB_PATH = os.environ.get(
        "SQLITE_DB_PATH",
        os.path.join(BASE_DIR, "carwash.db")
    )
    # MongoDB URI for main database
    MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/carwash_main")
    # Toggle sync on/off
    SYNC_ENABLED = os.environ.get("SYNC_ENABLED", "1") == "1"
