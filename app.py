# app.py
from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta, time
from functools import wraps
from pymongo import MongoClient, ASCENDING, DESCENDING
from bson.objectid import ObjectId
from bson.errors import InvalidId
import json
import os
import logging

# --- Config ---
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "your-secret-key-here")

MONGO_URI = os.environ.get(
    "MONGO_URI",
    "mongodb+srv://carwashDeveloper:developer08200280repoleved@carwashcluster.vurz4fv.mongodb.net/?retryWrites=true&w=majority&appName=carwashCluster"
)
MONGO_DBNAME = os.environ.get("MONGO_DBNAME", "carwash")

# --- Mongo setup ---
client = MongoClient(MONGO_URI)
db = client[MONGO_DBNAME]

users_col = db["users"]
vehicles_col = db["vehicles"]
orders_col = db["orders"]
summaries_col = db["shift_summaries"]
counters_col = db["counters"]  # for auto-increment integer ids
customers_col = db["customers"]

# Logging
logging.basicConfig(level=logging.INFO)

# Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"

# ---------- Helpers ----------
def get_next_sequence(name: str) -> int:
    """Auto-increment sequence (like SQL autoincrement). Returns next int."""
    res = counters_col.find_one_and_update(
        {"_id": name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    # When upsert creates the doc, find_one_and_update returns the document *before* update in older drivers;
    # ensure seq exists:
    if not res or "seq" not in res:
        # initialize then fetch
        counters_col.update_one({"_id": name}, {"$setOnInsert": {"seq": 1}}, upsert=True)
        res = counters_col.find_one({"_id": name})
    return int(res["seq"])

def iso(dt):
    if isinstance(dt, datetime):
        return dt.isoformat()
    return dt

def safe_json_load(s, default):
    if s is None:
        return default
    if isinstance(s, (dict, list)):
        return s
    try:
        return json.loads(s)
    except Exception:
        return default

def serialize_doc_for_api(doc: dict) -> dict:
    """Return a JSON-serializable dict similar to original sqlite row dict."""
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out

# ---------- User model & loader ----------
class User(UserMixin):
    def __init__(self, id, username, full_name, role, shift=None, created_at=None):
        self.id = id
        self.username = username
        self.full_name = full_name
        self.role = role
        self.shift = shift
        self.created_at = created_at

@login_manager.user_loader
def load_user(user_id):
    """
    Load a user for Flask-Login.

    Behavior:
    - First attempts to treat `user_id` as an integer 'id' field (legacy SQLite compatibility).
    - If not found, falls back to treating `user_id` as a MongoDB ObjectId string.
    - Normalizes `created_at` to an ISO string when possible and passes it into the User model.

    Returns:
        User instance or None
    """
    if not user_id:
        return None

    user_doc = None

    # Try integer id first (legacy behavior)
    try:
        uid_int = int(user_id)
        user_doc = users_col.find_one({"id": uid_int})
    except Exception:
        user_doc = None

    # Fallback: try ObjectId lookup
    if not user_doc:
        try:
            user_doc = users_col.find_one({"_id": ObjectId(user_id)})
        except Exception:
            user_doc = None

    if not user_doc:
        return None

    # Normalize created_at: if it's a datetime, convert to ISO string; otherwise pass through (could be ISO string)
    created_at = user_doc.get("created_at")
    try:
        if isinstance(created_at, datetime):
            created_at = created_at.isoformat()
    except Exception:
        # If datetime is not imported or any other error, leave created_at as-is
        pass

    return User(
        id=user_doc.get("id") or str(user_doc.get("_id")),
        username=user_doc.get("username"),
        full_name=user_doc.get("full_name"),
        role=user_doc.get("role"),
        shift=user_doc.get("shift"),
        created_at=created_at
    )

# ---------- Decorator ----------
def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for("login"))
            if current_user.role not in roles:
                flash("Access denied. Insufficient permissions.")
                return redirect(url_for("dashboard"))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# ---------- Shift helpers ----------
def get_current_shift():
    now = datetime.now().time()
    if time(5, 0) <= now < time(17, 0):
        return "AM"
    else:
        return "PM"

def get_shift_date():
    now = datetime.now()
    if get_current_shift() == "PM" and now.time() < time(5, 0):
        return (now - timedelta(days=1)).date()
    return now.date()

def is_shift_active(user_shift):
    return user_shift == get_current_shift()

# ---------- Business logic ----------
def calculate_shares(base_price, addons, vehicle_data):
    base_shares = {"sixb": 0.7, "washer": 0.3}
    addon_shares = {
        "Wax": {"sixb": 0.4, "washer": 0.6},
        "Buffing": {"sixb": 0.5, "washer": 0.5},
        "Deep Cleaning": {"sixb": 0.5, "washer": 0.5},
        "Engine Wash": {"sixb": 0.5, "washer": 0.5},
    }

    base_after_deduction = float(base_price) - 40
    sixb_base = base_after_deduction * base_shares["sixb"]
    washer_base = base_after_deduction * base_shares["washer"]

    sixb_addons = 0
    washer_addons = 0

    # vehicle_data['addons'] may be JSON string or dict
    addons_data = {}
    if vehicle_data:
        addons_data = safe_json_load(vehicle_data.get("addons"), {})

    for addon in addons or []:
        addon_price = addons_data.get(addon, 0)
        shares = addon_shares.get(addon, {"sixb": 0.5, "washer": 0.5})
        sixb_addons += float(addon_price) * shares["sixb"]
        washer_addons += float(addon_price) * shares["washer"]

    return {"sixb_shares": sixb_base + sixb_addons, "washer_shares": washer_base + washer_addons}

# ---------- Routes (kept signatures & behavior) ----------
@app.route("/")
def index():
    if current_user.is_authenticated:
        if current_user.role == "incharge":
            return redirect(url_for("dashboard"))
        else:
            return redirect(url_for("admin_dashboard"))
    return redirect(url_for("login"))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        data = request.get_json() or {}
        username = data.get("username")
        password = data.get("password")

        if not username or not password:
            return jsonify({"success": False, "message": "Missing username or password"}), 400

        user_doc = users_col.find_one({"username": username})
        if user_doc and user_doc.get("password_hash") and check_password_hash(user_doc["password_hash"], password):
            user = User(
                id=user_doc.get("id") or str(user_doc.get("_id")),
                username=user_doc.get("username"),
                full_name=user_doc.get("full_name"),
                role=user_doc.get("role"),
                shift=user_doc.get("shift")
            )
            login_user(user)
            return jsonify({"success": True, "role": user.role})
        return jsonify({"success": False, "message": "Invalid credentials"}), 401

    return render_template("login.html")

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("login"))

@app.route("/dashboard")
@login_required
@role_required("incharge")
def dashboard():
    shift_active = is_shift_active(current_user.shift)
    return render_template("dashboard.html", user=current_user, shift_active=shift_active, current_shift=current_user.shift)

@app.route("/admin_dashboard")
@login_required
@role_required("admin", "developer")
def admin_dashboard():
    return render_template("admin_dashboard.html", user=current_user)

@app.route("/summary")
@login_required
@role_required("admin", "developer")
def summary():
    return render_template("summary.html", user=current_user)

@app.route("/users")
@login_required
@role_required("admin", "developer")
def users():
    return render_template("users.html", user=current_user)

@app.route("/vehicles")
@login_required
def vehicles():
    return render_template("vehicles.html", user=current_user)

@app.route("/customers")
@login_required
@role_required("admin", "developer")
def customers():
    return render_template("customers.html", user=current_user)

# --- Orders API (POST stores same shapes as old SQLite; GET returns parsed shapes like original) ---
@app.route("/api/orders", methods=["GET", "POST"])
@login_required
def api_orders():
    if request.method == "POST":
        data = request.get_json() or {}
        app.logger.info(f"Order data received: {data}")

        # Find vehicle doc
        vehicle_type = data.get("vehicle_type")
        vehicle_doc = vehicles_col.find_one({"vehicle_name": vehicle_type})
        if not vehicle_doc:
            vehicle_doc = {"addons": "{}"}  # old app used '{}' default

        shares = calculate_shares(data.get("base_price", 0), data.get("addons", []), vehicle_doc)

        washer_name = data.get("washer_name") or ""
        if not washer_name:
            washer_name = "Unknown Washer"
        app.logger.info(f"Using washer_name: {washer_name}")

        # Keep fields as in original SQLite schema: w_vac 'yes'/'no', addons JSON string, timestamp ISO string
        order_doc = {
            "id": get_next_sequence("orders"),
            "incharge_name": current_user.full_name,
            "washer_name": washer_name,
            "vehicle_type": vehicle_type,
            "base_service": data.get("base_service"),
            "base_price": float(data.get("base_price", 0)),
            "plate_number": data.get("plate_number", ""),
            "w_vac": "yes" if data.get("w_vac") else "no",
            "addons": json.dumps(data.get("addons", [])),  # store as JSON string like original
            "washer_shares": float(shares["washer_shares"]),
            "sixb_shares": float(shares["sixb_shares"]),
            "sss": 2,
            "vac": 5 if data.get("w_vac") else 0,
            "less_40": 40,
            "shift": current_user.shift,
            "timestamp": datetime.now().isoformat()
        }

        orders_col.insert_one(order_doc)
        return jsonify({"success": True})

    # GET
    date = request.args.get("date")
    shift = request.args.get("shift")

    query = {}
    if date and shift:
        # Expect date like YYYY-MM-DD
        start = datetime.fromisoformat(date)
        end = start + timedelta(days=1)
        # orders store timestamp as ISO string; query by string range or by parsed datetime not available.
        # To replicate behaviour deterministically: we query on string prefix
        # But safer: query by date string match of leading YYYY-MM-DD
        query = {"timestamp": {"$regex": f'^{date}'}, "shift": shift}
    elif current_user.role == "incharge":
        shift_date = get_shift_date()
        date_str = str(shift_date)
        query = {"incharge_name": current_user.full_name, "shift": current_user.shift, "timestamp": {"$regex": f'^{date_str}'}}
    # else admin/developer -> no filter

    cursor = orders_col.find(query).sort("timestamp", DESCENDING)
    orders = []
    for doc in cursor:
        row = serialize_doc_for_api(doc)
        # convert addons stored as JSON string into list for response (matching original response)
        try:
            row["addons"] = json.loads(row.get("addons") or "[]")
        except Exception:
            row["addons"] = []
        # ensure timestamp stays as ISO string (it already is)
        orders.append(row)

    return jsonify(orders)

# --- Update shift summary (keeps same stored shapes: JSON strings in db; API returns same format as original) ---
@app.route("/api/update_summary", methods=["POST"])
@login_required
def api_update_summary():
    try:
        shift_date = get_shift_date()
        current_shift = get_current_shift()
        date_str = str(shift_date)

        # fetch orders for this incharge & shift same as original (matching prefix on timestamp)
        pipeline = [
            {"$match": {"incharge_name": current_user.full_name, "shift": current_user.shift, "timestamp": {"$regex": f'^{date_str}'}}}
        ]
        cursor = orders_col.aggregate(pipeline)
        orders = [serialize_doc_for_api(d) for d in cursor]

        if not orders:
            return jsonify({"success": False, "message": "No orders found for this shift"})

        total_gross_sales = sum(float(o.get("sixb_shares", 0)) for o in orders)
        total_addons = 0
        addons_details = {}

        for order in orders:
            vname = order.get("vehicle_type")
            vdoc = vehicles_col.find_one({"vehicle_name": vname})
            addons_data = safe_json_load(vdoc.get("addons") if vdoc else None, {})
            try:
                order_addons = json.loads(order.get("addons") or "[]")
            except Exception:
                order_addons = []
            for addon in order_addons:
                if addon in addons_data:
                    total_addons += addons_data[addon]
                    addons_details[addon] = addons_details.get(addon, 0) + addons_data[addon]

        forty_x = len(orders) * 40
        pos_payment = len(orders) * 5

        # parse request payload for other income/expenses
        data = {}
        if request.is_json:
            try:
                data = request.get_json() or {}
            except Exception:
                data = {}

        other_income = sum(item.get("amount", 0) for item in data.get("other_income", [])) if data.get("other_income") else 0
        expenses = sum(item.get("amount", 0) for item in data.get("expenses", [])) if data.get("expenses") else 0

        total_vac = sum(float(order.get("vac", 0)) for order in orders)

        summary_doc = {
            "id": get_next_sequence("shift_summaries"),
            "incharge_name": current_user.full_name,
            "date": date_str,
            "shift": current_shift,
            # store these as JSON strings to match original schema
            "addons": json.dumps(addons_details),
            "other_income": json.dumps(data.get("other_income", [])),
            "expenses": json.dumps(data.get("expenses", [])),
            "forty_x": forty_x,
            "wages": 400,
            "total_gross_sales": total_gross_sales,
            "total_sss": len(orders) * 2,
            "total_vac": total_vac,
            "total_addons": total_addons,
            "total_other_income": other_income,
            "gcash": 0,
            "pos_payment": pos_payment,
            "grand_total": total_gross_sales + forty_x + total_addons + other_income - expenses - 400 - pos_payment - total_vac,
            "updated_at": datetime.now().isoformat()
        }

        # Upsert by (incharge_name, date, shift)
        summaries_col.update_one(
            {"incharge_name": summary_doc["incharge_name"], "date": summary_doc["date"], "shift": summary_doc["shift"]},
            {"$set": summary_doc},
            upsert=True
        )

        return jsonify({"success": True, "message": "Shift summary updated successfully"})

    except Exception as e:
        app.logger.exception("Error updating shift summary")
        return jsonify({"success": False, "message": str(e)})

# --- Vehicles API (store vehicles similarly to old schema: bases JSON string? original stored bases JSON string)
@app.route("/api/vehicles", methods=["GET", "POST", "PUT"])
@login_required
def api_vehicles():
    if request.method == "POST":
        data = request.get_json() or {}
        vehicle_name = data.get("vehicle_name")
        bases = data.get("bases", [])
        addons = data.get("addons", {})

        if not vehicle_name:
            return jsonify({"success": False, "message": "Missing vehicle_name"}), 400

        if vehicles_col.find_one({"vehicle_name": vehicle_name}):
            return jsonify({"success": False, "message": "Vehicle already exists"}), 400

        vehicles_col.insert_one({
            "id": get_next_sequence("vehicles"),
            "vehicle_name": vehicle_name,
            "bases": json.dumps(bases),   # store as JSON string to match original sqlite
            "addons": json.dumps(addons)
        })
        return jsonify({"success": True})

    if request.method == "PUT":
        data = request.get_json() or {}
        vehicle_name = data.get("vehicle_name")
        bases = data.get("bases", [])
        addons = data.get("addons", {})

        if not vehicle_name:
            return jsonify({"success": False, "message": "Missing vehicle_name"}), 400

        vehicles_col.update_one({"vehicle_name": vehicle_name}, {"$set": {"bases": json.dumps(bases), "addons": json.dumps(addons)}})
        return jsonify({"success": True})

    # GET
    cursor = vehicles_col.find()
    out = []
    for doc in cursor:
        row = serialize_doc_for_api(doc)
        # parse JSON fields to match the original API response
        row["bases"] = safe_json_load(row.get("bases"), [])
        row["addons"] = safe_json_load(row.get("addons"), {})
        out.append(row)
    return jsonify(out)

# --- Shift summary retrieval (returns parsed fields like the original) ---
@app.route("/api/shift_summary/<date>/<shift>")
@login_required
def api_shift_summary(date, shift):
    doc = summaries_col.find_one({"date": date, "shift": shift})
    if not doc:
        return jsonify(None)
    row = serialize_doc_for_api(doc)
    row["addons"] = safe_json_load(row.get("addons"), {})
    row["expenses"] = safe_json_load(row.get("expenses"), [])
    row["other_income"] = safe_json_load(row.get("other_income"), [])
    return jsonify(row)

# --- Users endpoints (keep integer id interface) ---
@app.route("/api/users", methods=["GET", "POST"])
@login_required
@role_required("admin", "developer")
def api_users():
    if request.method == "POST":
        data = request.get_json() or {}
        full_name = data.get("full_name")
        username = data.get("username")
        role = data.get("role")
        shift = data.get("shift")
        password = data.get("password")

        if current_user.role == "admin" and role == "developer":
            return jsonify({"success": False, "message": "Admins cannot create developer accounts"}), 403

        if users_col.find_one({"username": username}):
            return jsonify({"success": False, "message": "Username already exists"}), 400

        password_hash = generate_password_hash(password) if password else None

        users_col.insert_one({
            "id": get_next_sequence("users"),
            "full_name": full_name,
            "username": username,
            "password_hash": password_hash,
            "role": role,
            "shift": shift,
            "created_at": datetime.now().isoformat()
        })

        return jsonify({"success": True})

    # GET all users
    cursor = users_col.find()
    out = []
    for doc in cursor:
        row = serialize_doc_for_api(doc)
        out.append(row)
    return jsonify(out)

@app.route("/api/users/<int:user_id>", methods=["PUT", "DELETE"])
@login_required
@role_required("admin", "developer")
def api_user(user_id):
    # Find user by integer id (legacy)
    target = users_col.find_one({"id": int(user_id)})
    if not target:
        return jsonify({"success": False, "message": "User not found"}), 404

    if request.method == "PUT":
        data = request.get_json() or {}
        full_name = data.get("full_name")
        username = data.get("username")
        role = data.get("role")
        shift = data.get("shift")
        password = data.get("password")

        if current_user.role == "admin" and target.get("role") == "developer":
            return jsonify({"success": False, "message": "Admins cannot edit developer accounts"}), 403
        if current_user.role == "admin" and role == "developer":
            return jsonify({"success": False, "message": "Admins cannot assign developer role"}), 403

        if username and users_col.find_one({"username": username, "id": {"$ne": target["id"]}}):
            return jsonify({"success": False, "message": "Username already exists"}), 400

        update = {}
        if full_name:
            update["full_name"] = full_name
        if username:
            update["username"] = username
        if role:
            update["role"] = role
        if shift is not None:
            update["shift"] = shift
        if password:
            update["password_hash"] = generate_password_hash(password)

        if update:
            users_col.update_one({"id": target["id"]}, {"$set": update})
            return jsonify({"success": True})
        return jsonify({"success": False, "message": "No data to update"}), 400

    # DELETE
    if current_user.role == "admin" and target.get("role") == "developer":
        return jsonify({"success": False, "message": "Admins cannot delete developer accounts"}), 403

    users_col.delete_one({"id": target["id"]})
    return jsonify({"success": True})

# --- Customers API ---
@app.route("/api/customers", methods=["GET", "POST"])
@login_required
@role_required("admin", "developer")
def api_customers():
    if request.method == "POST":
        data = request.get_json() or {}
        plate_number = data.get("plate_number")
        customer_name = data.get("customer_name")
        contact_no = data.get("contact_no")
        vehicle_name = data.get("vehicle_name")

        if not plate_number:
            return jsonify({"success": False, "message": "Plate number is required"}), 400

        if customers_col.find_one({"plate_number": plate_number}):
            return jsonify({"success": False, "message": "Plate number already assigned"}), 400

        # Calculate number of washes from orders
        washes = orders_col.count_documents({"plate_number": plate_number})

        customers_col.insert_one({
            "id": get_next_sequence("customers"),
            "plate_number": plate_number,
            "customer_name": customer_name,
            "contact_no": contact_no,
            "vehicle_name": vehicle_name,
            "washes": washes
        })
        return jsonify({"success": True})

    # GET
    cursor = customers_col.find()
    customers = []
    for doc in cursor:
        customers.append(serialize_doc_for_api(doc))
    return jsonify(customers)

@app.route("/api/customers/<customer_id>", methods=["GET", "PUT", "DELETE"])
@login_required
@role_required("admin", "developer")
def api_customer(customer_id):
    try:
        customer = customers_col.find_one({"_id": ObjectId(customer_id)})
        if not customer:
            return jsonify({"success": False, "message": "Customer not found"}), 404

        if request.method == "GET":
            return jsonify(serialize_doc_for_api(customer))

        if request.method == "PUT":
            data = request.get_json() or {}
            plate_number = data.get("plate_number", customer["plate_number"])

            # Update washes count if plate number changed
            washes = customer.get("washes", 0)
            if plate_number != customer["plate_number"]:
                washes = orders_col.count_documents({"plate_number": plate_number})

            update_data = {
                "plate_number": plate_number,
                "customer_name": data.get("customer_name", customer.get("customer_name")),
                "contact_no": data.get("contact_no", customer.get("contact_no")),
                "vehicle_name": data.get("vehicle_name", customer.get("vehicle_name")),
                "washes": washes
            }

            customers_col.update_one({"_id": ObjectId(customer_id)}, {"$set": update_data})
            return jsonify({"success": True})

        if request.method == "DELETE":
            customers_col.delete_one({"_id": ObjectId(customer_id)})
            return jsonify({"success": True})

    except InvalidId:
        return jsonify({"success": False, "message": "Invalid customer ID"}), 400
    except Exception as e:
        app.logger.exception("Error handling customer")
        return jsonify({"success": False, "message": str(e)}), 500

# --- DB inspector / convenience endpoints similar to original ---
@app.route("/database")
@login_required
@role_required("admin", "developer")
def database():
    return render_template("database.html", user=current_user)

@app.route("/api/database/tables")
@login_required
@role_required("admin", "developer")
def api_database_tables():
    try:
        collections = db.list_collection_names()
        collections = [c for c in collections if not c.startswith("system.")]
        return jsonify({"success": True, "tables": collections})
    except Exception as e:
        app.logger.exception("Error listing collections")
        return jsonify({"success": False, "message": str(e)})

@app.route("/api/database/table/<table_name>")
@login_required
@role_required("admin", "developer")
def api_database_table(table_name):
    try:
        if table_name not in db.list_collection_names():
            return jsonify({"success": False, "message": "Collection not found"}), 404
        cursor = db[table_name].find().limit(1000)
        rows = [serialize_doc_for_api(r) for r in cursor]
        return jsonify({"success": True, "rows": rows})
    except Exception as e:
        app.logger.exception("Error fetching collection data")
        return jsonify({"success": False, "message": str(e)})

@app.route("/api/database/table/<table_name>/row/<int:row_id>", methods=["DELETE"])
@login_required
@role_required("admin", "developer")
def api_database_delete_row(table_name, row_id):
    try:
        if table_name not in db.list_collection_names():
            return jsonify({"success": False, "message": "Collection not found"}), 404

        # Try delete by integer 'id' (keeps compatibility); fallback delete by _id
        res = db[table_name].delete_one({"id": int(row_id)})
        if res.deleted_count == 0:
            # try delete by ObjectId string
            try:
                res2 = db[table_name].delete_one({"_id": ObjectId(row_id)})
                if res2.deleted_count == 0:
                    return jsonify({"success": False, "message": "Row not found"}), 404
            except Exception:
                return jsonify({"success": False, "message": "Row not found"}), 404

        return jsonify({"success": True})
    except Exception as e:
        app.logger.exception("Error deleting row")
        return jsonify({"success": False, "message": str(e)})

# --- Monthly Sales API ---
@app.route("/api/monthly_sales", methods=["GET"])
@login_required
@role_required("admin", "developer")
def api_monthly_sales():
    month = int(request.args.get("month"))
    year = int(request.args.get("year"))

    # Get all shift summaries for the specified month and year
    start_date = f"{year}-{str(month).zfill(2)}-01"
    end_date = f"{year}-{str(month).zfill(2)}-31"

    pipeline = [
        {
            "$match": {
                "date": {"$gte": start_date, "$lte": end_date}
            }
        },
        {
            "$group": {
                "_id": "$date",
                "total": {"$sum": "$grand_total"}
            }
        },
        {
            "$sort": {"_id": 1}
        }
    ]

    cursor = summaries_col.aggregate(pipeline)
    results = []
    for doc in cursor:
        results.append({
            "date": doc["_id"],
            "amount": doc["total"]
        })

    return jsonify(results)

# --- Yearly Sales API ---
@app.route("/api/yearly_sales", methods=["GET"])
@login_required
@role_required("admin", "developer")
def api_yearly_sales():
    year = int(request.args.get("year"))

    # Get all shift summaries for the specified year
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"

    pipeline = [
        {
            "$match": {
                "date": {"$gte": start_date, "$lte": end_date}
            }
        },
        {
            "$group": {
                "_id": {"$substr": ["$date", 0, 7]},  # Group by year-month
                "total": {"$sum": "$grand_total"}
            }
        },
        {
            "$sort": {"_id": 1}
        }
    ]

    cursor = summaries_col.aggregate(pipeline)
    results = []
    for doc in cursor:
        month_name = datetime.strptime(doc["_id"], "%Y-%m").strftime("%B")
        results.append({
            "month": month_name,
            "amount": doc["total"]
        })

    return jsonify(results)

# --- Startup: create useful indexes if absent ---
def ensure_indexes():
    try:
        users_col.create_index([("username", ASCENDING)], unique=True)
        users_col.create_index([("id", ASCENDING)], unique=True)
        vehicles_col.create_index([("vehicle_name", ASCENDING)], unique=True)
        vehicles_col.create_index([("id", ASCENDING)], unique=True)
        orders_col.create_index([("id", ASCENDING)], unique=True)
        summaries_col.create_index([("id", ASCENDING)], unique=True)
        summaries_col.create_index([("incharge_name", ASCENDING), ("date", ASCENDING), ("shift", ASCENDING)], unique=True)
        customers_col.create_index([("plate_number", ASCENDING)], unique=True)
    except Exception:
        app.logger.warning("Index creation failed or already exists.")

@app.route("/api/unassigned_plates")
@login_required
@role_required("admin", "developer")
def api_unassigned_plates():
    # Get all plate numbers from orders
    pipeline = [
        {"$group": {"_id": "$plate_number"}},
        {"$project": {"plate_number": "$_id", "_id": 0}}
    ]
    cursor = orders_col.aggregate(pipeline)
    all_plates = [doc["plate_number"] for doc in cursor if doc["plate_number"]]

    # Get all assigned plate numbers
    assigned_plates = [customer["plate_number"] for customer in customers_col.find()]

    # Find unassigned plates
    unassigned_plates = [plate for plate in all_plates if plate not in assigned_plates]

    return jsonify(unassigned_plates)

if __name__ == "__main__":
    ensure_indexes()
    app.run(debug=True)