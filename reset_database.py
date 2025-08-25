#!/usr/bin/env python3
"""
Reset the database with the correct schema.
"""

import os
import sqlite3
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

    # Add shift_summaries table if it doesn't exist
    print("Adding shift_summaries table...")
    conn = sqlite3.connect('carwash.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS shift_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            shift TEXT NOT NULL CHECK(shift IN ('AM', 'PM')),
            carwasher_name TEXT NOT NULL,
            total_gross_sales REAL NOT NULL,
            forty_x REAL NOT NULL,
            addons TEXT NOT NULL,
            other_income TEXT NOT NULL,
            expenses TEXT NOT NULL,
            wages REAL NOT NULL,
            gcash REAL NOT NULL,
            grand_total REAL NOT NULL,
            created_at TEXT NOT NULL,
            created_by INTEGER NOT NULL,
            FOREIGN KEY (created_by) REFERENCES users (id)
        )
    ''')
    conn.commit()
    conn.close()

    print("Database reset complete!")

if __name__ == "__main__":
    main()