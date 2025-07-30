#!/usr/bin/env python3
"""
Startup script for the Carwash POS system.
This script will automatically initialize the database if needed and start the application.
"""

from app import create_app

if __name__ == "__main__":
    print("Starting Carwash POS System...")
    print("=" * 50)
    
    # Create and run the Flask app
    # The database initialization happens automatically in create_app()
    app = create_app()
    
    print("\nCarwash POS System is ready!")
    print("Access the application at: http://127.0.0.1:5000")
    print("\nDefault accounts:")
    print("  Admin: username='admin', password='admin123'")
    print("  Developer: username='developer', password='dev123'")
    print("=" * 50)
    
    app.run(debug=True, port=5000, host='0.0.0.0')