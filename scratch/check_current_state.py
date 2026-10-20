import sqlite3
import json

print("=== CHECKING TELECOM_PORTAL.DB ===")
conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

c.execute("SELECT DISTINCT pengelola FROM collo_records WHERE pengelola LIKE '%Bizn%'")
print("Collo Biznet in DB:", c.fetchall())

c.execute("SELECT id, no_pa, biaya_permintaan_awal, biaya_final, efisiensi_rupiah, efisiensi_persen FROM sitac_records WHERE no_pa LIKE '%A821103000308-2%'")
print("PA A821103000308-2 in DB:", c.fetchall())

print("\n=== CHECKING SITAC_COLLO_DATA.JSON ===")
with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

biz_json = set(r.get('pengelola') for r in d.get('collo_records', []) if 'bizn' in (r.get('pengelola') or '').lower())
print("Collo Biznet in JSON:", biz_json)

pa_matches = [r for r in d.get('sitac_records', []) if 'A821103000308-2' in (r.get('no_pa') or '')]
for p in pa_matches:
    print("PA in JSON:", p.get('id'), p.get('no_pa'), p.get('biaya_permintaan_awal'), p.get('biaya_final'), p.get('efisiensi_rupiah'))

print("\n=== CHECKING SITAC_COLLO_DATA.JS ===")
with open('sitac_collo_data.js', 'r', encoding='utf-8') as f:
    js_text = f.read(500)
    print("JS text starts with:", js_text[:100])
