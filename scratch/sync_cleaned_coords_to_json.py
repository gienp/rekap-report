import json
import sqlite3

# 1. Read updated sitac_records from telecom_portal.db
conn = sqlite3.connect('telecom_portal.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()
c.execute("SELECT * FROM sitac_records ORDER BY id ASC")
db_sitac_rows = [dict(r) for r in c.fetchall()]
conn.close()

db_sitac_map = {r['id']: r for r in db_sitac_rows}
print(f"Total sitac rows in DB: {len(db_sitac_rows)}")
print(f"Sitac rows with coords in DB: {sum(1 for r in db_sitac_rows if r['latitude'] and r['longitude'])}")

# 2. Update sitac_collo_data.json
with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    master_data = json.load(f)

updated_sitac_list = []
for s in master_data.get('sitac_records', []):
    sid = s.get('id')
    db_rec = db_sitac_map.get(sid)
    if db_rec:
        s['latitude'] = db_rec['latitude']
        s['longitude'] = db_rec['longitude']
        s['coord_type'] = db_rec['coord_type']
    else:
        # Check if it has real coords
        ct = (s.get('coord_type') or '').upper()
        if ct not in ('EXACT', 'EXACT_COORDS', 'USER_INPUT'):
            s['latitude'] = None
            s['longitude'] = None
            s['coord_type'] = None
    updated_sitac_list.append(s)

master_data['sitac_records'] = updated_sitac_list

with open('sitac_collo_data.json', 'w', encoding='utf-8') as f:
    json.dump(master_data, f, ensure_ascii=False, indent=2)

print("Updated sitac_collo_data.json successfully.")
print(f"sitac_records with coords in JSON: {sum(1 for s in updated_sitac_list if s.get('latitude') and s.get('longitude'))}")

# 3. Update sitac_collo_data.js
js_content = f"// Telecom Infrastructure & Lease Operations Portal - Unified Master Data\nwindow.SITAC_COLLO_DATA = {json.dumps(master_data, ensure_ascii=False)};\n"
with open('sitac_collo_data.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print("Updated sitac_collo_data.js successfully.")
