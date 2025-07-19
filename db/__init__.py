import sqlite3
import threading
import time
from contextlib import contextmanager

from config import Config
from .models import Order
#from pymongo import MongoClient  # uncomment when ready

# Initialize local DB (SQLite)
def init_db():
    with get_db() as conn:
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT NOT NULL,
                synced INTEGER DEFAULT 0
            )
        ''')
        conn.commit()

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
