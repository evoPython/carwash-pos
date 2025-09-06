from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta, time
import json
import os
from functools import wraps

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# SQLite DB path
DB_PATH = "carwash_pos.db"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

class User(UserMixin):
    def __init__(self, id, username, full_name, role, shift=None):
        self.id = id
        self.username = username
        self.full_name = full_name
        self.role = role
        self.shift = shift

@login_manager.user_loader
def load_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user_data = cursor.fetchone()
    conn.close()
    
    if user_data:
        return User(
            id=user_data['id'],
            username=user_data['username'],
            full_name=user_data['full_name'],
            role=user_data['role'],
            shift=user_data['shift']
        )
    return None

def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for('login'))
            if current_user.role not in roles:
                flash('Access denied. Insufficient permissions.')
                return redirect(url_for('dashboard'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def get_current_shift():
    """Determine current shift based on time"""
    now = datetime.now().time()
    if time(5, 0) <= now < time(17, 0):
        return 'AM'
    else:
        return 'PM'

def get_shift_date():
    """Get the date for shift tracking (PM shift uses previous date)"""
    now = datetime.now()
    if get_current_shift() == 'PM' and now.time() < time(5, 0):
        return (now - timedelta(days=1)).date()
    return now.date()

def is_shift_active(user_shift):
    """Check if user's shift is currently active"""
    current_shift = get_current_shift()
    return user_shift == current_shift

def calculate_shares(base_price, addons, vehicle_data):
    """Calculate sixb and washer shares based on business rules"""
    base_shares = {'sixb': 0.7, 'washer': 0.3}
    addon_shares = {
        'Wax': {'sixb': 0.4, 'washer': 0.6},
        'Buffing': {'sixb': 0.5, 'washer': 0.5},
        'Deep Cleaning': {'sixb': 0.5, 'washer': 0.5},
        'Engine Wash': {'sixb': 0.5, 'washer': 0.5}
    }
    
    # Base calculation (after less 40)
    base_after_deduction = float(base_price) - 40
    sixb_base = base_after_deduction * base_shares['sixb']
    washer_base = base_after_deduction * base_shares['washer']
    
    # Addon calculations
    sixb_addons = 0
    washer_addons = 0
    
    # vehicle_data['addons'] stored as JSON string or dict
    if isinstance(vehicle_data.get('addons'), str):
        try:
            addons_data = json.loads(vehicle_data['addons'])
        except Exception:
            addons_data = {}
    else:
        addons_data = vehicle_data.get('addons') or {}

    for addon in addons:
        addon_price = addons_data.get(addon, 0)
        shares = addon_shares.get(addon, {'sixb': 0.5, 'washer': 0.5})
        sixb_addons += float(addon_price) * shares['sixb']
        washer_addons += float(addon_price) * shares['washer']
    
    return {
        'sixb_shares': sixb_base + sixb_addons,
        'washer_shares': washer_base + washer_addons
    }

@app.route('/')
def index():
    if current_user.is_authenticated:
        if current_user.role == 'incharge':
            return redirect(url_for('dashboard'))
        else:
            return redirect(url_for('admin_dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json()
        username = data['username']
        password = data['password']
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        user_data = cursor.fetchone()
        conn.close()
        
        if user_data and user_data['password_hash'] and check_password_hash(user_data['password_hash'], password):
            user = User(
                id=user_data['id'],
                username=user_data['username'],
                full_name=user_data['full_name'],
                role=user_data['role'],
                shift=user_data['shift']
            )
            login_user(user)
            return jsonify({'success': True, 'role': user.role})
        
        return jsonify({'success': False, 'message': 'Invalid credentials'})
    
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
@role_required('incharge')
def dashboard():
    shift_active = is_shift_active(current_user.shift)
    return render_template('dashboard.html',
                         user=current_user,
                         shift_active=shift_active,
                         current_shift=current_user.shift)

@app.route('/admin_dashboard')
@login_required
@role_required('admin', 'developer')
def admin_dashboard():
    return render_template('admin_dashboard.html', user=current_user)

@app.route('/summary')
@login_required
@role_required('admin', 'developer')
def summary():
    return render_template('summary.html', user=current_user)

@app.route('/users')
@login_required
@role_required('admin', 'developer')
def users():
    return render_template('users.html', user=current_user)

@app.route('/vehicles')
@login_required
def vehicles():
    return render_template('vehicles.html', user=current_user)

@app.route('/api/orders', methods=['GET', 'POST'])
@login_required
def api_orders():
    if request.method == 'POST':
        data = request.get_json()

        # Log the incoming data for debugging
        app.logger.info(f"Order data received: {data}")

        # Get vehicle data for calculations
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM vehicles WHERE vehicle_name = ?", (data['vehicle_type'],))
        vehicle_data = cursor.fetchone()

        if not vehicle_data:
            # If no vehicle found, use empty addon dict to avoid crashes
            vehicle_data = {'addons': '{}'}
        else:
            # Convert sqlite3.Row to dict for compatibility
            vehicle_data = dict(vehicle_data)

        # Calculate shares
        shares = calculate_shares(
            data['base_price'],
            data.get('addons', []),
            vehicle_data
        )

        # Ensure washer_name is not null
        washer_name = data.get('washer_name', '')
        if not washer_name:
            washer_name = 'Unknown Washer'

        # Log the washer name being used
        app.logger.info(f"Using washer_name: {washer_name}")

        # Insert order
        order_data = (
            current_user.full_name,
            washer_name,
            data['vehicle_type'],
            data['base_service'],
            data['base_price'],
            data.get('plate_number', ''),
            'yes' if data.get('w_vac') else 'no',
            json.dumps(data.get('addons', [])),
            shares['washer_shares'],
            shares['sixb_shares'],
            2,  # SSS always 2
            5 if data.get('w_vac') else 0,  # VAC
            40,  # less 40 always 40
            current_user.shift,
            datetime.now().isoformat()
        )

        cursor.execute("""
            INSERT INTO orders (incharge_name, washer_name, vehicle_type, base_service, base_price,
            plate_number, w_vac, addons, washer_shares, sixb_shares, sss, vac, less_40,
            shift, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, order_data)

        conn.commit()
        conn.close()

        return jsonify({'success': True})

    # GET orders with optional date and shift filters
    date = request.args.get('date')
    shift = request.args.get('shift')

    conn = get_db_connection()
    cursor = conn.cursor()

    if date and shift:
        # Filter by specific date and shift
        cursor.execute("""
            SELECT * FROM orders
            WHERE date(timestamp) = ? AND shift = ?
            ORDER BY timestamp DESC
        """, (date, shift))
    elif current_user.role == 'incharge':
        # For incharge users, show only their orders for current shift
        shift_date = get_shift_date()
        cursor.execute("""
            SELECT * FROM orders
            WHERE incharge_name = ? AND shift = ? AND date(timestamp) = ?
            ORDER BY timestamp DESC
        """, (current_user.full_name, current_user.shift, str(shift_date)))
    else:
        # For admin/developer, show all orders
        cursor.execute("SELECT * FROM orders ORDER BY timestamp DESC")

    orders = [dict(row) for row in cursor.fetchall()]
    conn.close()

    # Convert datetime strings to isoformat if needed and parse addons
    for order in orders:
        # Timestamp is stored as ISO string already
        if order.get('timestamp'):
            order['timestamp'] = order['timestamp']
        # Parse addons (stored as JSON string)
        try:
            order['addons'] = json.loads(order.get('addons') or '[]')
        except Exception:
            order['addons'] = []

    return jsonify(orders)

@app.route('/api/update_summary', methods=['POST'])
@login_required
def api_update_summary():
    """Update shift summary in the database"""
    try:
        # Get current shift information
        shift_date = get_shift_date()
        current_shift = get_current_shift()

        # Calculate summary data from orders
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get orders for current user and shift
        cursor.execute("""
            SELECT * FROM orders
            WHERE incharge_name = ? AND shift = ? AND date(timestamp) = ?
        """, (current_user.full_name, current_user.shift, str(shift_date)))

        orders = [dict(r) for r in cursor.fetchall()]

        if not orders:
            conn.close()
            return jsonify({'success': False, 'message': 'No orders found for this shift'})

        # Calculate totals
        total_gross_sales = sum(float(order.get('sixb_shares', 0)) for order in orders)
        total_addons = 0
        addons_details = {}

        # Get vehicle data for addon calculations
        for order in orders:
            cursor.execute("SELECT addons FROM vehicles WHERE vehicle_name = ?", (order['vehicle_type'],))
            vehicle = cursor.fetchone()
            if vehicle:
                try:
                    addons_data = json.loads(vehicle['addons'])
                except Exception:
                    addons_data = {}
                try:
                    order_addons = json.loads(order.get('addons') or '[]')
                except Exception:
                    order_addons = []
                for addon in order_addons:
                    if addon in addons_data:
                        total_addons += addons_data[addon]
                        if addon not in addons_details:
                            addons_details[addon] = 0
                        addons_details[addon] += addons_data[addon]

        forty_x = len(orders) * 40
        pos_payment = len(orders) * 5

        # Get other income and expenses from request
        data = {}
        if request.is_json:
            try:
                data = request.get_json() or {}
            except Exception:
                data = {}
        else:
            data = {}

        other_income = sum(item['amount'] for item in data.get('other_income', [])) if data.get('other_income') else 0
        expenses = sum(item['amount'] for item in data.get('expenses', [])) if data.get('expenses') else 0

        # Prepare summary data
        total_vac = sum(float(order.get('vac', 0)) for order in orders)
        summary_data = {
            'incharge_name': current_user.full_name,
            'date': str(shift_date),
            'shift': current_shift,
            'addons': json.dumps(addons_details),
            'other_income': json.dumps(data.get('other_income', [])),
            'expenses': json.dumps(data.get('expenses', [])),
            'forty_x': forty_x,
            'wages': 400,
            'total_gross_sales': total_gross_sales,
            'total_sss': len(orders) * 2,  # 2 SSS per order
            'total_vac': total_vac,
            'total_addons': total_addons,
            'total_other_income': other_income,
            'gcash': 0,  # Not implemented yet
            'pos_payment': pos_payment,
            'grand_total': total_gross_sales + forty_x + total_addons + other_income - expenses - 400 - pos_payment - total_vac
        }

        # Upsert into shift_summaries
        # Assumes a UNIQUE constraint exists on (incharge_name, date, shift)
        cursor.execute("""
            INSERT INTO shift_summaries
            (incharge_name, date, shift, addons, other_income, expenses, forty_x, wages,
            total_gross_sales, total_sss, total_vac, total_addons,
            total_other_income, gcash, pos_payment, grand_total)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(incharge_name, date, shift) DO UPDATE SET
            addons = excluded.addons,
            other_income = excluded.other_income,
            expenses = excluded.expenses,
            forty_x = excluded.forty_x,
            wages = excluded.wages,
            total_gross_sales = excluded.total_gross_sales,
            total_sss = excluded.total_sss,
            total_vac = excluded.total_vac,
            total_addons = excluded.total_addons,
            total_other_income = excluded.total_other_income,
            gcash = excluded.gcash,
            pos_payment = excluded.pos_payment,
            grand_total = excluded.grand_total
        """, (
            summary_data['incharge_name'],
            summary_data['date'],
            summary_data['shift'],
            summary_data['addons'],
            summary_data.get('other_income', '[]'),
            summary_data['expenses'],
            summary_data['forty_x'],
            summary_data['wages'],
            summary_data['total_gross_sales'],
            summary_data['total_sss'],
            summary_data['total_vac'],
            summary_data['total_addons'],
            summary_data['total_other_income'],
            summary_data['gcash'],
            summary_data['pos_payment'],
            summary_data['grand_total']
        ))

        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Shift summary updated successfully'})

    except Exception as e:
        app.logger.exception("Error updating shift summary")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/vehicles', methods=['GET', 'POST', 'PUT'])
@login_required
def api_vehicles():
    if request.method == 'POST':
        data = request.get_json()
        vehicle_name = data['vehicle_name']
        bases = data['bases']
        addons = data['addons']

        # Check if vehicle already exists
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM vehicles WHERE vehicle_name = ?", (vehicle_name,))
        existing_vehicle = cursor.fetchone()

        if existing_vehicle:
            conn.close()
            return jsonify({'success': False, 'message': 'Vehicle already exists'}), 400

        # Insert new vehicle
        vehicle_data = (
            vehicle_name,
            json.dumps(bases),
            json.dumps(addons)
        )
        cursor.execute("""
            INSERT INTO vehicles (vehicle_name, bases, addons)
            VALUES (?, ?, ?)
        """, vehicle_data)

        conn.commit()
        conn.close()

        return jsonify({'success': True})

    elif request.method == 'PUT':
        data = request.get_json()
        vehicle_name = data['vehicle_name']
        bases = data['bases']
        addons = data['addons']

        # Update existing vehicle
        conn = get_db_connection()
        cursor = conn.cursor()
        vehicle_data = (
            json.dumps(bases),
            json.dumps(addons),
            vehicle_name
        )
        cursor.execute("""
            UPDATE vehicles
            SET bases = ?, addons = ?
            WHERE vehicle_name = ?
        """, vehicle_data)

        conn.commit()
        conn.close()

        return jsonify({'success': True})

    # GET method - existing functionality
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vehicles")
    vehicles = [dict(r) for r in cursor.fetchall()]
    conn.close()

    # Parse JSON fields
    for vehicle in vehicles:
        try:
            vehicle['bases'] = json.loads(vehicle.get('bases') or '[]')
        except Exception:
            vehicle['bases'] = []
        try:
            vehicle['addons'] = json.loads(vehicle.get('addons') or '{}')
        except Exception:
            vehicle['addons'] = {}

    return jsonify(vehicles)

@app.route('/api/shift_summary/<date>/<shift>')
@login_required
def api_shift_summary(date, shift):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM shift_summaries
        WHERE date = ? AND shift = ?
    """, (date, shift))
    summary = cursor.fetchone()
    conn.close()

    if summary:
        summary = dict(summary)
        # Parse JSON fields
        try:
            summary['addons'] = json.loads(summary.get('addons') or '{}')
        except Exception:
            summary['addons'] = {}
        try:
            summary['expenses'] = json.loads(summary.get('expenses') or '[]')
        except Exception:
            summary['expenses'] = []
        try:
            summary['other_income'] = json.loads(summary.get('other_income', '[]') or '[]')
        except Exception:
            summary['other_income'] = []
        return jsonify(summary)

    return jsonify(None)

@app.route('/api/users', methods=['GET', 'POST'])
@login_required
@role_required('admin', 'developer')
def api_users():
    if request.method == 'POST':
        data = request.get_json()
        full_name = data['full_name']
        username = data['username']
        role = data['role']
        shift = data.get('shift')
        password = data.get('password')

        # Check if current user is admin and trying to create a developer
        if current_user.role == 'admin' and role == 'developer':
            return jsonify({'success': False, 'message': 'Admins cannot create developer accounts'}), 403

        # Check if username already exists
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        existing_user = cursor.fetchone()

        if existing_user:
            conn.close()
            return jsonify({'success': False, 'message': 'Username already exists'}), 400

        # Hash password if provided
        password_hash = None
        if password:
            password_hash = generate_password_hash(password)

        # Insert new user
        user_data = (full_name, username, password_hash, role, shift)
        cursor.execute("""
            INSERT INTO users (full_name, username, password_hash, role, shift)
            VALUES (?, ?, ?, ?, ?)
        """, user_data)

        conn.commit()
        conn.close()

        return jsonify({'success': True})

    # GET all users
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users")
    users = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify(users)

@app.route('/api/users/<int:user_id>', methods=['PUT', 'DELETE'])
@login_required
@role_required('admin', 'developer')
def api_user(user_id):
    if request.method == 'PUT':
        data = request.get_json()
        full_name = data.get('full_name')
        username = data.get('username')
        role = data.get('role')
        shift = data.get('shift')
        password = data.get('password')

        # Get the target user's current role
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
        target_user = cursor.fetchone()

        if not target_user:
            conn.close()
            return jsonify({'success': False, 'message': 'User not found'}), 404

        # Check if current user is admin trying to edit a developer
        if current_user.role == 'admin' and target_user['role'] == 'developer':
            conn.close()
            return jsonify({'success': False, 'message': 'Admins cannot edit developer accounts'}), 403

        # Check if current user is admin trying to assign developer role
        if current_user.role == 'admin' and role == 'developer':
            conn.close()
            return jsonify({'success': False, 'message': 'Admins cannot assign developer role'}), 403

        # Check if username is being changed to an existing one
        if username:
            cursor.execute("SELECT * FROM users WHERE username = ? AND id != ?", (username, user_id))
            existing_user = cursor.fetchone()
            if existing_user:
                conn.close()
                return jsonify({'success': False, 'message': 'Username already exists'}), 400

        # Build update query
        update_fields = []
        update_params = []

        if full_name:
            update_fields.append("full_name = ?")
            update_params.append(full_name)
        if username:
            update_fields.append("username = ?")
            update_params.append(username)
        if role:
            update_fields.append("role = ?")
            update_params.append(role)
        if shift is not None:
            update_fields.append("shift = ?")
            update_params.append(shift)

        # Handle password update separately
        if password:
            password_hash = generate_password_hash(password)
            update_fields.append("password_hash = ?")
            update_params.append(password_hash)

        update_params.append(user_id)

        if update_fields:
            cursor.execute(f"""
                UPDATE users
                SET {', '.join(update_fields)}
                WHERE id = ?
            """, update_params)

            conn.commit()
            conn.close()
            return jsonify({'success': True})

        conn.close()
        return jsonify({'success': False, 'message': 'No data to update'}), 400

    elif request.method == 'DELETE':
        # Get the target user's current role
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
        target_user = cursor.fetchone()

        if not target_user:
            conn.close()
            return jsonify({'success': False, 'message': 'User not found'}), 404

        # Check if current user is admin trying to delete a developer
        if current_user.role == 'admin' and target_user['role'] == 'developer':
            conn.close()
            return jsonify({'success': False, 'message': 'Admins cannot delete developer accounts'}), 403

        # Delete user
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()

        return jsonify({'success': True})

@app.route('/database')
@login_required
@role_required('admin', 'developer')
def database():
    return render_template('database.html', user=current_user)

@app.route('/api/database/tables')
@login_required
@role_required('admin', 'developer')
def api_database_tables():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        tables = [row['name'] for row in cursor.fetchall()]
        conn.close()
        return jsonify({'success': True, 'tables': tables})
    except Exception as e:
        app.logger.exception("Error listing tables")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/database/table/<table_name>')
@login_required
@role_required('admin', 'developer')
def api_database_table(table_name):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Basic protection: prevent sqlite meta queries via table_name (still be careful in production)
        if not table_name.isidentifier():
            conn.close()
            return jsonify({'success': False, 'message': 'Invalid table name'}), 400

        cursor.execute(f"SELECT * FROM {table_name}")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()

        # Convert timestamp-like strings if possible
        for row in rows:
            for key, value in list(row.items()):
                if isinstance(value, str):
                    # attempt to detect ISO datetime strings and leave as-is
                    # keep as string for JSON (already serializable)
                    pass
                elif isinstance(value, (datetime,)):
                    row[key] = value.isoformat()
        return jsonify({'success': True, 'rows': rows})
    except Exception as e:
        app.logger.exception("Error fetching table data")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/database/table/<table_name>/row/<int:row_id>', methods=['DELETE'])
@login_required
@role_required('admin', 'developer')
def api_database_delete_row(table_name, row_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Get primary key column name using PRAGMA table_info
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        if not columns:
            conn.close()
            return jsonify({'success': False, 'message': 'Table not found'}), 404

        # columns are sqlite3.Row objects with fields: cid, name, type, notnull, dflt_value, pk
        primary_key = columns[0]['name']

        cursor.execute(f"DELETE FROM {table_name} WHERE {primary_key} = ?", (row_id,))
        conn.commit()
        conn.close()

        return jsonify({'success': True})
    except Exception as e:
        app.logger.exception("Error deleting row")
        return jsonify({'success': False, 'message': str(e)})

if __name__ == '__main__':
    # Ensure DB file exists (optional): just creates file if not present. Schema creation not handled here.
    if not os.path.exists(DB_PATH):
        open(DB_PATH, 'a').close()
    app.run(debug=True)
