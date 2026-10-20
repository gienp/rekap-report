import sqlite3
import json

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute('SELECT id, pelanggan, terminating, latitude, longitude, coord_type FROM sitac_records LIMIT 15')
for row in c.fetchall():
    print(f"DB: ID {row[0]} | {str(row[1])[:20]} | {str(row[2])[:35]} -> ({row[3]}, {row[4]}) [{row[5]}]")

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

print("\n--- JSON DATA ---")
for s in d.get('sitac_records', [])[:15]:
    print(f"JSON: ID {s.get('id')} | {str(s.get('pelanggan', ''))[:20]} | {str(s.get('terminating', ''))[:35]} -> ({s.get('latitude')}, {s.get('longitude')})")
