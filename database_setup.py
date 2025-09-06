import sqlite3
from werkzeug.security import generate_password_hash
import json
import os

DB_FILE = "carwash_pos.db"

def setup_database():
    """Create database and tables"""
    # Remove old db if resetting
    if os.path.exists(DB_FILE):
        os.remove(DB_FILE)

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            full_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT CHECK(role IN ('incharge', 'admin', 'developer')) NOT NULL,
            username TEXT UNIQUE NOT NULL,
            shift TEXT CHECK(shift IN ('AM', 'PM'))
        )
    """)

    # Create orders table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incharge_name TEXT NOT NULL,
            washer_name TEXT DEFAULT '',
            vehicle_type TEXT NOT NULL,
            base_service TEXT NOT NULL,
            base_price REAL NOT NULL,
            plate_number TEXT NOT NULL,
            w_vac TEXT CHECK(w_vac IN ('yes', 'no')) NOT NULL,
            addons TEXT,
            washer_shares REAL NOT NULL,
            sixb_shares REAL NOT NULL,
            sss REAL DEFAULT 2,
            vac REAL DEFAULT 0,
            less_40 REAL DEFAULT 40,
            shift TEXT CHECK(shift IN ('AM', 'PM')) NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create shift_summaries table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS shift_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incharge_name TEXT NOT NULL,
            date DATE NOT NULL,
            shift TEXT CHECK(shift IN ('AM', 'PM')) NOT NULL,
            addons TEXT,
            other_income TEXT,
            expenses TEXT,
            forty_x REAL DEFAULT 0,
            wages REAL DEFAULT 400,
            total_gross_sales REAL DEFAULT 0,
            total_sss REAL DEFAULT 0,
            total_vac REAL DEFAULT 0,
            total_addons REAL DEFAULT 0,
            total_other_income REAL DEFAULT 0,
            gcash REAL DEFAULT 0,
            pos_payment REAL DEFAULT 0,
            grand_total REAL DEFAULT 0,
            UNIQUE(incharge_name, date, shift)
        )
    """)

    # Create vehicles table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_name TEXT UNIQUE NOT NULL,
            bases TEXT NOT NULL,
            addons TEXT NOT NULL
        )
    """)

    # Insert default developer user
    temp_password = generate_password_hash('dev123')
    cursor.execute("""
        INSERT OR IGNORE INTO users (full_name, password_hash, role, username)
        VALUES ('Administrator', ?, 'developer', 'developer')
    """, (temp_password,))

    # Insert sample vehicles
    car_bases = {
        "Bodywash": {"price": 200, "vac": False},
        "Bodywash with Vacuum": {"price": 250, "vac": True},
        "Vacuum Only": {"price": 50, "vac": True},
        "Spray Only": {"price": 100, "vac": False}
    }
    car_addons = {
        "Wax": 80,
        "Buffing": 100,
        "Deep Cleaning": 150,
        "Engine Wash": 120
    }

    cursor.execute("""
        INSERT OR IGNORE INTO vehicles (vehicle_name, bases, addons)
        VALUES ('Car', ?, ?)
    """, (json.dumps(car_bases), json.dumps(car_addons)))

    suv_bases = {
        "Bodywash": {"price": 250, "vac": False},
        "Bodywash with Vacuum": {"price": 300, "vac": True},
        "Vacuum Only": {"price": 70, "vac": True},
        "Spray Only": {"price": 120, "vac": False}
    }

    cursor.execute("""
        INSERT OR IGNORE INTO vehicles (vehicle_name, bases, addons)
        VALUES ('SUV', ?, ?)
    """, (json.dumps(suv_bases), json.dumps(car_addons)))

    conn.commit()
    conn.close()
    print("SQLite database setup completed successfully!")

if __name__ == '__main__':
    setup_database()
