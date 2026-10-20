import sqlite3
import json

print("=== SQLITE USERS ===")
try:
    conn = sqlite3.connect('telecom_portal.db')
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in c.fetchall()]
    print("Tables:", tables)
    for t in tables:
        if 'user' in t.lower():
            c.execute(f"PRAGMA table_info({t})")
            cols = [col[1] for col in c.fetchall()]
            print(f"Columns in {t}:", cols)
            c.execute(f"SELECT * FROM {t}")
            rows = c.fetchall()
            for r in rows:
                print(" ", r)
except Exception as e:
    print("Sqlite error:", e)

print("\n=== USERS.JSON ===")
try:
    with open('scratch/users.json', encoding='utf-8') as f:
        data = json.load(f)
        for u in data:
            print(u)
except Exception as e:
    print("users.json error:", e)
