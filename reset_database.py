#!/usr/bin/env python3
"""
Reset the database with the correct schema.
"""

import os
from db import init_db

def main():
    # Remove existing database files
    db_files = [f for f in os.listdir('.') if f.endswith('.db')]
    for db_file in db_files:
        try:
            os.remove(db_file)
            print(f"Removed {db_file}")
        except FileNotFoundError:
            pass
    
    # Initialize the database with correct schema
    print("Initializing database...")
    init_db()
    print("Database reset complete!")

if __name__ == "__main__":
    main()