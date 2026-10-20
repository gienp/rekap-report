import sqlite3
import json

# 1. Update SQLite telecom_portal.db
conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute("UPDATE collo_records SET biaya_deposit = 2150000 WHERE id = 2752 OR no_so LIKE '%A311202001848%'")
conn.commit()

c.execute("SELECT id, no_so, pelanggan, biaya_deposit FROM collo_records WHERE biaya_deposit > 0")
print("SQLite updated:", c.fetchall())
conn.close()

# 2. Update sitac_collo_data.js
with open('sitac_collo_data.js', 'r', encoding='utf-8') as f:
    text = f.read()

prefix = 'window.SITAC_COLLO_DATA = '
raw_json = text[len(prefix):].strip().rstrip(';')
data = json.loads(raw_json)

updated_count = 0
for r in data.get('collo_records', []):
    if r.get('id') == 2752 or 'A311202001848' in str(r.get('no_so', '')):
        r['biaya_deposit'] = 2150000
        updated_count += 1

print(f"Updated {updated_count} records in sitac_collo_data.js")

with open('sitac_collo_data.js', 'w', encoding='utf-8') as f:
    f.write(prefix + json.dumps(data) + ';\n')

print("sitac_collo_data.js saved successfully.")
