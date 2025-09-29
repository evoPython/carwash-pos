# database_setup.py
from pymongo import MongoClient, ASCENDING
from werkzeug.security import generate_password_hash
import json
import os
from datetime import datetime

# Configuration: change via env if needed
MONGO_URI = os.environ.get(
    "MONGO_URI",
    "mongodb+srv://carwashDeveloper:developer08200280repoleved@carwashcluster.vurz4fv.mongodb.net/?retryWrites=true&w=majority&appName=carwashCluster"
)
MONGO_DBNAME = os.environ.get("MONGO_DBNAME", "carwash")

def setup_database():
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DBNAME]

    # Drop existing collections to mirror removing the SQLite file.
    # WARNING: This deletes existing data in these collections.
    for col in ["users", "vehicles", "orders", "shift_summaries", "counters", "customers"]:
        if col in db.list_collection_names():
            db.drop_collection(col)

    users_col = db["users"]
    vehicles_col = db["vehicles"]
    orders_col = db["orders"]
    summaries_col = db["shift_summaries"]
    counters_col = db["counters"]
    customers_col = db["customers"]

    # Create indexes similar to SQLite constraints.
    users_col.create_index([("username", ASCENDING)], unique=True)
    users_col.create_index([("id", ASCENDING)], unique=True)
    vehicles_col.create_index([("vehicle_name", ASCENDING)], unique=True)
    vehicles_col.create_index([("id", ASCENDING)], unique=True)
    summaries_col.create_index([("incharge_name", ASCENDING), ("date", ASCENDING), ("shift", ASCENDING)], unique=True)
    summaries_col.create_index([("id", ASCENDING)], unique=True)
    orders_col.create_index([("id", ASCENDING)], unique=True)
    vehicles_col.create_index([("id", ASCENDING)], unique=True)
    customers_col.create_index([("plate_number", ASCENDING)], unique=True)

    # Insert default developer user (mimic INSERT OR IGNORE)
    dev_pass_hash = generate_password_hash("dev123")
    # In SQLite, id would be 1 for first insert; we preserve that using counters below.
    dev_user = {
        "id": 1,
        "created_at": datetime.utcnow().isoformat(),
        "full_name": "Administrator",
        "password_hash": dev_pass_hash,
        "role": "developer",
        "username": "developer",
        "shift": None
    }
    users_col.insert_one(dev_user)

    # Vehicles data (same values as your SQLite script)
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

    suv_bases = {
        "Bodywash": {"price": 250, "vac": False},
        "Bodywash with Vacuum": {"price": 300, "vac": True},
        "Vacuum Only": {"price": 70, "vac": True},
        "Spray Only": {"price": 120, "vac": False}
    }

    # Store bases/addons as JSON strings to match original SQLite storage
    vehicles_col.insert_one({
        "id": 1,
        "vehicle_name": "Car",
        "bases": json.dumps(car_bases),
        "addons": json.dumps(car_addons)
    })

    vehicles_col.insert_one({
        "id": 2,
        "vehicle_name": "SUV",
        "bases": json.dumps(suv_bases),
        "addons": json.dumps(car_addons)
    })

    # No orders or summaries inserted initially (empty collections)
    # Set up counters (auto-increment) so new inserts get appropriate next ids
    # counters collection documents will be like: {"_id": "users", "seq": <n>}
    # We set seq to the current maximum id value so next id = seq + 1.

    counters_col.insert_many([
        {"_id": "users", "seq": 1},           # one user inserted -> next id will be 2
        {"_id": "vehicles", "seq": 2},        # two vehicles inserted -> next id will be 3
        {"_id": "orders", "seq": 0},          # none yet -> next id will be 1
        {"_id": "shift_summaries", "seq": 0},  # none yet -> next id will be 1
        {"_id": "customers", "seq": 0}       # none yet -> next id will be 1
    ])

    # Print summary
    print("MongoDB database setup completed successfully!")
    print(f"Database: {MONGO_DBNAME}")
    print("Inserted:")
    print(" - users: 1 (developer)")
    print(" - vehicles: 2 (Car, SUV)")
    print("Counters initialised: users=1, vehicles=2, orders=0, shift_summaries=0, customers=0")

    client.close()


if __name__ == "__main__":
    setup_database()
