import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class Config:
    # Flask secret key for sessions and CSRF protection
    SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production")
    
    # SQLite local DB path
    SQLITE_DB_PATH = os.environ.get(
        "SQLITE_DB_PATH",
        os.path.join(BASE_DIR, "carwash.db")
    )
    # MongoDB URI for main database
    MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/carwash_main")
    # Toggle sync on/off
    SYNC_ENABLED = os.environ.get("SYNC_ENABLED", "1") == "1"
    
    # Authentication settings
    REMEMBER_COOKIE_DURATION = 86400  # 24 hours in seconds
    SESSION_PROTECTION = 'basic'  # Changed from 'strong' to prevent logout issues when switching pages
    PERMANENT_SESSION_LIFETIME = 86400  # 24 hours
    SESSION_COOKIE_SECURE = False  # Set to True in production with HTTPS
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
