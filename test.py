from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ConfigurationError, OperationFailure

uri = "mongodb+srv://carwashDeveloper:evopy08200280ypove@carwashcluster.k14sa9a.mongodb.net/?retryWrites=true&w=majority&appName=carwashCluster"

try:
    # Create a client and try to connect
    client = MongoClient(uri, serverSelectionTimeoutMS=5000, tls=True)  # 5s timeout
    # Force a call to trigger connection
    client.admin.command("ping")
    print("✅ Successfully connected to MongoDB!")
except (ConnectionFailure, ConfigurationError, OperationFailure) as e:
    print("❌ Could not connect to MongoDB:", e)
