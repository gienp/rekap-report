import sqlite3
import openpyxl

print("--- TABLES IN telecom_portal.db ---")
conn = sqlite3.connect('telecom_portal.db')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
for (t,) in tables:
    cursor.execute(f'SELECT COUNT(*) FROM "{t}"')
    print(f"  {t}: {cursor.fetchone()[0]} rows")

print("\n--- SCHEMA FOR TABLES ---")
for (t,) in tables:
    if 'sitac' in t.lower() or 'perijinan' in t.lower() or 'collo' in t.lower() or 'gangguan' in t.lower():
        cursor.execute(f'PRAGMA table_info("{t}")')
        cols = [c[1] for c in cursor.fetchall()]
        print(f"  {t} cols: {cols}")
