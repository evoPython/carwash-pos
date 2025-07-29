import sqlite3
import threading
import time
from contextlib import contextmanager
from werkzeug.security import generate_password_hash

from config import Config
from .models import Order, User, Role
#from pymongo import MongoClient  # uncomment when ready

# Initialize local DB (SQLite)
def init_db():
    with get_db() as conn:
        c = conn.cursor()
        
        # Create orders table
        c.execute('''
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT NOT NULL,
                synced INTEGER DEFAULT 0
            )
        ''')
        
        # Create users table for authentication
        c.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            )
        ''')
        
        conn.commit()
        
        # Create default admin user if no users exist
        _create_default_users(conn)

def _create_default_users(conn):
    """Create default users if none exist."""
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM users")
    user_count = c.fetchone()[0]
    
    if user_count == 0:
        # Create default admin user
        from datetime import datetime
        admin_password_hash = generate_password_hash('admin123')  # Change this in production!
        
        c.execute('''
            INSERT INTO users (username, email, password_hash, role, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            'admin',
            'admin@carwash.local',
            admin_password_hash,
            Role.ADMIN,
            1,
            datetime.utcnow().isoformat()
        ))
        
        # Create default developer user
        dev_password_hash = generate_password_hash('dev123')  # Change this in production!
        
        c.execute('''
            INSERT INTO users (username, email, password_hash, role, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            'developer',
            'dev@carwash.local',
            dev_password_hash,
            Role.DEVELOPER,
            1,
            datetime.utcnow().isoformat()
        ))
        
        conn.commit()
        print("Default users created:")
        print("  Admin: username='admin', password='admin123'")
        print("  Developer: username='developer', password='dev123'")
        print("  Please change these passwords in production!")

@contextmanager
def get_db():
    conn = sqlite3.connect(Config.SQLITE_DB_PATH)
    try:
        yield conn
    finally:
        conn.close()

def add_order(order_dict):
    """Insert a new order and mark it unsynced."""
    raw = Order.serialize(order_dict)
    with get_db() as conn:
        c = conn.cursor()
        c.execute(
            "INSERT INTO orders (data, synced) VALUES (?, 0)",
            (raw,)
        )
        conn.commit()
        return c.lastrowid

# Stub: sync unsynced orders to MongoDB
def _sync_worker(poll_interval=10):
    #client = MongoClient(Config.MONGO_URI)
    #db = client.get_default_database()
    while Config.SYNC_ENABLED:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("SELECT id, data FROM orders WHERE synced = 0")
            rows = c.fetchall()
            for order_id, raw in rows:
                order = Order.deserialize(raw)
                #db.orders.insert_one(order)   # push to Mongo
                c.execute("UPDATE orders SET synced = 1 WHERE id = ?", (order_id,))
            conn.commit()
        time.sleep(poll_interval)

def start_sync_thread():
    t = threading.Thread(target=_sync_worker, daemon=True)
    t.start()

# ============================================
# USER AUTHENTICATION FUNCTIONS
# ============================================

def get_user_by_id(user_id):
    """Get user by ID for Flask-Login."""
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE id = ? AND is_active = 1", (user_id,))
        row = c.fetchone()
        return User.from_db_row(row) if row else None

def get_user_by_username(username):
    """Get user by username."""
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE username = ? AND is_active = 1", (username,))
        row = c.fetchone()
        return User.from_db_row(row) if row else None

def get_user_by_email(email):
    """Get user by email."""
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE email = ? AND is_active = 1", (email,))
        row = c.fetchone()
        return User.from_db_row(row) if row else None

def create_user(username, email, password, role):
    """Create a new user."""
    from datetime import datetime
    
    # Check if username or email already exists
    if get_user_by_username(username):
        raise ValueError("Username already exists")
    if get_user_by_email(email):
        raise ValueError("Email already exists")
    
    # Validate role
    if role not in Role.get_all_roles():
        raise ValueError(f"Invalid role. Must be one of: {Role.get_all_roles()}")
    
    password_hash = generate_password_hash(password)
    
    with get_db() as conn:
        c = conn.cursor()
        c.execute('''
            INSERT INTO users (username, email, password_hash, role, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            username,
            email,
            password_hash,
            role,
            1,
            datetime.utcnow().isoformat()
        ))
        conn.commit()
        return c.lastrowid

def get_all_users():
    """Get all active users."""
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE is_active = 1 ORDER BY created_at DESC")
        rows = c.fetchall()
        return [User.from_db_row(row) for row in rows]

def update_user_role(user_id, new_role):
    """Update user's role."""
    if new_role not in Role.get_all_roles():
        raise ValueError(f"Invalid role. Must be one of: {Role.get_all_roles()}")
    
    with get_db() as conn:
        c = conn.cursor()
        c.execute("UPDATE users SET role = ? WHERE id = ?", (new_role, user_id))
        conn.commit()
        return c.rowcount > 0

def deactivate_user(user_id):
    """Deactivate a user (soft delete)."""
    with get_db() as conn:
        c = conn.cursor()
        c.execute("UPDATE users SET is_active = 0 WHERE id = ?", (user_id,))
        conn.commit()
        return c.rowcount > 0

def activate_user(user_id):
    """Activate a user."""
    with get_db() as conn:
        c = conn.cursor()
        c.execute("UPDATE users SET is_active = 1 WHERE id = ?", (user_id,))
        conn.commit()
        return c.rowcount > 0

def change_user_password(user_id, new_password):
    """Change user's password."""
    password_hash = generate_password_hash(new_password)
    
    with get_db() as conn:
        c = conn.cursor()
        c.execute("UPDATE users SET password_hash = ? WHERE id = ?", (password_hash, user_id))
        conn.commit()
        return c.rowcount > 0
