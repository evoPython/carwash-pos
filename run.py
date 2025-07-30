import os
from db import init_db
from app import create_app

def main():
    # --- Database Reset ---
    # Define the path to the database file
    db_path = 'carwash.db'
    
    # Remove the database file if it exists
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
            print(f"Removed existing database: {db_path}")
        except OSError as e:
            print(f"Error removing database file {db_path}: {e}")
            return

    # Initialize the database with the correct schema
    print("Initializing a new database...")
    try:
        init_db()
        print("Database initialization complete!")
    except Exception as e:
        print(f"Error initializing database: {e}")
        return

    # --- Start Application ---
    print("Starting the Flask application...")
    try:
        app = create_app()
        app.run(debug=True, port=5000)
    except Exception as e:
        print(f"Error starting the application: {e}")

if __name__ == "__main__":
    main()