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
        
        # Check if database needs reinitialization
        try:
            c.execute("PRAGMA table_info(users)")
            columns = [column[1] for column in c.fetchall()]
            
            # If users table doesn't exist or doesn't have full_name column, reinitialize
            if not columns or 'full_name' not in columns:
                print("Database schema outdated or empty. Reinitializing...")
                _reinitialize_database(conn)
            else:
                print("Database schema is up to date.")
                # Still create default users if none exist
                _create_default_users(conn)
                
        except Exception as e:
            print(f"Error checking database schema: {e}")
            print("Reinitializing database...")
            _reinitialize_database(conn)

def _reinitialize_database(conn):
    """Reinitialize the database with the new schema."""
    c = conn.cursor()
    
    # Drop existing tables if they exist
    c.execute("DROP TABLE IF EXISTS orders")
    c.execute("DROP TABLE IF EXISTS users")
    c.execute("DROP TABLE IF EXISTS legacy_orders")
    
    # Create orders table with new structure
    c.execute('''
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_name TEXT NOT NULL,
            plate_no TEXT NOT NULL,
            w_vac TEXT NOT NULL CHECK(w_vac IN ('Yes', 'No')),
            addons TEXT NOT NULL,
            price REAL NOT NULL,
            less_40 REAL DEFAULT 40,
            c_shares REAL NOT NULL,
            w_share REAL NOT NULL,
            w_name TEXT NOT NULL,
            sss REAL DEFAULT 2,
            timestamp TEXT NOT NULL,
            shift TEXT NOT NULL CHECK(shift IN ('AM', 'PM')),
            created_by INTEGER NOT NULL,
            synced INTEGER DEFAULT 0,
            FOREIGN KEY (created_by) REFERENCES users (id)
        )
    ''')
    
    # Create users table for authentication with new structure
    c.execute('''
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            shift TEXT CHECK(shift IN ('AM', 'PM')),
            shift_start TEXT,
            shift_end TEXT
        )
    ''')
    
    # Create legacy orders table for backward compatibility (if needed)
    c.execute('''
        CREATE TABLE legacy_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL,
            synced INTEGER DEFAULT 0
        )
    ''')
    
    conn.commit()
    print("Database reinitialized with new schema.")
    
    # Create default users
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
            INSERT INTO users (username, full_name, password_hash, role, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            'admin',
            'Administrator',
            admin_password_hash,
            Role.ADMIN,
            1,
            datetime.utcnow().isoformat()
        ))

        # Create default developer user
        dev_password_hash = generate_password_hash('dev123')  # Change this in production!

        c.execute('''
            INSERT INTO users (username, full_name, password_hash, role, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            'developer',
            'System Developer',
            dev_password_hash,
            Role.DEVELOPER,
            1,
            datetime.utcnow().isoformat()
        ))

        # Create TJ S. Balamban (PM shift)
        tj_password_hash = generate_password_hash('tj1234')

        c.execute('''
            INSERT INTO users (username, full_name, password_hash, role, is_active, created_at, shift)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            '123',
            'TJ S. Balamban',
            tj_password_hash,
            Role.INCHARGE,
            1,
            datetime.utcnow().isoformat(),
            'PM'
        ))

        # Create AM shift user
        am_password_hash = generate_password_hash('am1234')

        c.execute('''
            INSERT INTO users (username, full_name, password_hash, role, is_active, created_at, shift)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            'amuser',
            'AM Shift User',
            am_password_hash,
            Role.INCHARGE,
            1,
            datetime.utcnow().isoformat(),
            'AM'
        ))

        conn.commit()
        print("Default users created:")
        print("  Admin: username='admin', password='admin123'")
        print("  Developer: username='developer', password='dev123'")
        print("  TJ S. Balamban: username='123', password='tj1234', shift='PM'")
        print("  AM Shift User: username='amuser', password='am1234', shift='AM'")
        print("  Please change these passwords in production!")

@contextmanager
def get_db():
    conn = sqlite3.connect(Config.SQLITE_DB_PATH)
    try:
        yield conn
    finally:
        conn.close()

def add_order(order_dict):
    """Insert a new order with the new structure."""
    from datetime import datetime
    import json

    # Get current time (assuming system is in Manila timezone)
    current_time = datetime.now()

    # TEMPORARY for debugging, REMOVE IN PRODUCTION
    # current_time = datetime(2025, 8, 7, 16, 8, 0)

    # Determine shift based on time (5am-5pm = AM, rest = PM)
    shift = "AM" if 5 <= current_time.hour < 17 else "PM"

    # Use the pre-calculated values from the form
    price = order_dict.get('price', 0)
    w_vac = order_dict.get('w_vac', 'No')
    c_shares = order_dict.get('c_shares', 0)
    w_share = order_dict.get('w_share', 0)

    with get_db() as conn:
        c = conn.cursor()
        c.execute('''
            INSERT INTO orders (
                vehicle_name, plate_no, w_vac, addons, price, less_40,
                c_shares, w_share, w_name, sss, timestamp, shift, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            order_dict.get('vehicle_name', ''),
            order_dict.get('plate_no', ''),
            w_vac,
            order_dict.get('addons', ''),  # Store as string instead of JSON
            price,
            40,  # LESS 40 is always 40
            c_shares,
            w_share,
            order_dict.get('w_name', ''),
            2,  # SSS is always 2
            current_time.isoformat(),
            shift,
            order_dict.get('created_by', 1)  # Default to user ID 1 if not provided
        ))
        conn.commit()
        return c.lastrowid

def add_legacy_order(order_dict):
    """Insert a legacy order for backward compatibility."""
    raw = Order.serialize(order_dict)
    with get_db() as conn:
        c = conn.cursor()
        c.execute(
            "INSERT INTO legacy_orders (data, synced) VALUES (?, 0)",
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
            
            # Sync new structured orders
            c.execute("""
                SELECT id, vehicle_name, plate_no, w_vac, addons, price, less_40,
                       c_shares, w_share, w_name, sss, timestamp, shift, created_by
                FROM orders WHERE synced = 0
            """)
            rows = c.fetchall()
            for row in rows:
                order_id = row[0]
                # Convert row to dictionary for MongoDB
                order_dict = {
                    'id': row[0],
                    'vehicle_name': row[1],
                    'plate_no': row[2],
                    'w_vac': row[3],
                    'addons': row[4],
                    'price': row[5],
                    'less_40': row[6],
                    'c_shares': row[7],
                    'w_share': row[8],
                    'w_name': row[9],
                    'sss': row[10],
                    'timestamp': row[11],
                    'shift': row[12],
                    'created_by': row[13]
                }
                #db.orders.insert_one(order_dict)   # push to Mongo
                c.execute("UPDATE orders SET synced = 1 WHERE id = ?", (order_id,))
            
            # Also sync legacy orders if any exist
            c.execute("SELECT id, data FROM legacy_orders WHERE synced = 0")
            legacy_rows = c.fetchall()
            for order_id, raw in legacy_rows:
                order = Order.deserialize(raw)
                #db.legacy_orders.insert_one(order)   # push to Mongo
                c.execute("UPDATE legacy_orders SET synced = 1 WHERE id = ?", (order_id,))
            
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

def get_user_by_full_name(full_name):
    """Get user by full name."""
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE full_name = ? AND is_active = 1", (full_name,))
        row = c.fetchone()
        return User.from_db_row(row) if row else None

def create_user(username, full_name, password, role, shift=None, shift_start=None, shift_end=None):
    """Create a new user."""
    from datetime import datetime
    
    # Check if username or full name already exists
    if get_user_by_username(username):
        raise ValueError("Username already exists")
    if get_user_by_full_name(full_name):
        raise ValueError("Full name already exists")
    
    # Validate role
    if role not in Role.get_all_roles():
        raise ValueError(f"Invalid role. Must be one of: {Role.get_all_roles()}")
    
    password_hash = generate_password_hash(password)
    
    with get_db() as conn:
        c = conn.cursor()
        c.execute('''
            INSERT INTO users (username, full_name, password_hash, role, is_active, created_at, shift, shift_start, shift_end)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            username,
            full_name,
            password_hash,
            role,
            1,
            datetime.utcnow().isoformat(),
            shift,
            shift_start,
            shift_end
        ))
        conn.commit()
        return c.lastrowid

def update_user_shift(user_id, shift_start, shift_end):
    """Update user's shift schedule."""
    with get_db() as conn:
        c = conn.cursor()
        c.execute("UPDATE users SET shift_start = ?, shift_end = ? WHERE id = ?",
                 (shift_start, shift_end, user_id))
        conn.commit()
        return c.rowcount > 0

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
# ============================================
# SHIFT SUMMARY FUNCTIONS
# ============================================

def add_shift_summary(summary_dict):
    """Insert a new shift summary."""
    from datetime import datetime
    import json
    
    current_time = datetime.now()
    
    with get_db() as conn:
        c = conn.cursor()
        
        # Convert dictionaries to JSON strings
        addons_json = json.dumps(summary_dict.get('addons', {}))
        other_income_json = json.dumps(summary_dict.get('other_income', {}))
        expenses_json = json.dumps(summary_dict.get('expenses', {}))
        
        c.execute('''
            INSERT OR REPLACE INTO shift_summaries (
                date, shift, carwasher_name, total_gross_sales, forty_x,
                addons, other_income, expenses, wages, gcash, grand_total,
                created_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            summary_dict.get('date', ''),
            summary_dict.get('shift', ''),
            summary_dict.get('carwasher_name', ''),
            summary_dict.get('total_gross_sales', 0),
            summary_dict.get('forty_x', 0),
            addons_json,
            other_income_json,
            expenses_json,
            summary_dict.get('wages', 0),
            summary_dict.get('gcash', 0),
            summary_dict.get('grand_total', 0),
            current_time.isoformat(),
            summary_dict.get('created_by', 1)
        ))
        conn.commit()
        return c.lastrowid

def get_shift_summary(date, shift, carwasher_name=None):
    """Get shift summary for a specific date and shift."""
    import json
    
    with get_db() as conn:
        c = conn.cursor()
        
        if carwasher_name:
            c.execute('''
                SELECT id, date, shift, carwasher_name, total_gross_sales, forty_x,
                       addons, other_income, expenses, wages, gcash, grand_total,
                       created_at, created_by
                FROM shift_summaries
                WHERE date = ? AND shift = ? AND carwasher_name = ?
            ''', (date, shift, carwasher_name))
        else:
            c.execute('''
                SELECT id, date, shift, carwasher_name, total_gross_sales, forty_x,
                       addons, other_income, expenses, wages, gcash, grand_total,
                       created_at, created_by
                FROM shift_summaries
                WHERE date = ? AND shift = ?
            ''', (date, shift))
        
        rows = c.fetchall()
        summaries = []
        
        for row in rows:
            summary = {
                'id': row[0],
                'date': row[1],
                'shift': row[2],
                'carwasher_name': row[3],
                'total_gross_sales': row[4],
                'forty_x': row[5],
                'addons': json.loads(row[6]) if row[6] else {},
                'other_income': json.loads(row[7]) if row[7] else {},
                'expenses': json.loads(row[8]) if row[8] else {},
                'wages': row[9],
                'gcash': row[10],
                'grand_total': row[11],
                'created_at': row[12],
                'created_by': row[13]
            }
            summaries.append(summary)
        
        return summaries[0] if len(summaries) == 1 and carwasher_name else summaries

def get_all_shift_summaries(date=None, shift=None):
    """Get all shift summaries, optionally filtered by date and/or shift."""
    import json
    
    with get_db() as conn:
        c = conn.cursor()
        
        query = '''
            SELECT id, date, shift, carwasher_name, total_gross_sales, forty_x,
                   addons, other_income, expenses, wages, gcash, grand_total,
                   created_at, created_by
            FROM shift_summaries
        '''
        
        params = []
        conditions = []
        
        if date:
            conditions.append('date = ?')
            params.append(date)
        
        if shift:
            conditions.append('shift = ?')
            params.append(shift)
        
        if conditions:
            query += ' WHERE ' + ' AND '.join(conditions)
        
        query += ' ORDER BY date DESC, shift ASC, carwasher_name ASC'
        
        c.execute(query, params)
        rows = c.fetchall()
        
        summaries = []
        for row in rows:
            summary = {
                'id': row[0],
                'date': row[1],
                'shift': row[2],
                'carwasher_name': row[3],
                'total_gross_sales': row[4],
                'forty_x': row[5],
                'addons': json.loads(row[6]) if row[6] else {},
                'other_income': json.loads(row[7]) if row[7] else {},
                'expenses': json.loads(row[8]) if row[8] else {},
                'wages': row[9],
                'gcash': row[10],
                'grand_total': row[11],
                'created_at': row[12],
                'created_by': row[13]
            }
            summaries.append(summary)
        
        return summaries
