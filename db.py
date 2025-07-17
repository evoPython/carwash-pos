import sqlite3
import json

def init_db():
    conn = sqlite3.connect('carwash.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT,
            synced BOOLEAN DEFAULT 0
        )
    ''')

    conn.commit()
    conn.close()

def add_order(order_dict):
    conn = sqlite3.connect('carwash.db')
    c = conn.cursor()
    
    # insert the order
    json_data = json.dumps(order_dict)
    c.execute('INSERT INTO orders (data, synced) VALUES (?, ?)', (json_data, 0))
    conn.commit()
    
    # debug: print all current rows
    c.execute('SELECT id, data, synced FROM orders')
    rows = c.fetchall()
    print("\n[DEBUG] Current contents of 'orders' table:")
    for row in rows:
        print(f"ID: {row[0]} | Synced: {row[2]} | Data: {json.loads(row[1])}")
    
    conn.close()
