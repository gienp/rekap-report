import sqlite3
import json
import os

DB_PATH = 'telecom_portal.db'
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

def canonical_pengelola_extended(s):
    if not s:
        return ''
    raw = str(s).strip()
    u = raw.upper()

    # 1. Caturmas Kelola Sukses (Fix Caltumas typo & all-caps)
    if 'CATURMAS' in u or 'CALTUMAS' in u:
        return 'Caturmas Kelola Sukses'

    # 2. Indointernet
    if 'INDOINTERNET' in u or 'INDO INTERNET' in u:
        return 'Indointernet'

    # 3. Infrastruktur Cakrawala Telekomunikasi (Fix Infranstruktur typo)
    if 'CAKRAWALA TELEKOMUNIKASI' in u:
        return 'Infrastruktur Cakrawala Telekomunikasi'

    # 4. IDC (Internetindo Data Centra Indonesia)
    if 'INTERNETINDO DATA CENTRA' in u or ('IDC' in u and 'INTERNETINDO' in u):
        return 'IDC (Internetindo Data Centra Indonesia)'

    # 5. Crisis Center Menara Permai (Fix Cricis typo)
    if 'MENARA PERMAI' in u:
        return 'Crisis Center Menara Permai'

    # 6. Data Sinergitama Jaya (Elitery)
    if 'DATA SINERGITAMA' in u or 'ELITERY' in u:
        return 'Data Sinergitama Jaya (Elitery)'

    # 7. PLN Dist Jaya AP Bulungan
    if 'PLN DIST' in u and 'BULUNGAN' in u:
        return 'PLN Dist Jaya AP Bulungan'

    # 8. Graha Anugerah Sejahtera
    if 'GRAHA ANUGERAH' in u:
        return 'Graha Anugerah Sejahtera'

    # 9. Intershop Prima Center
    if 'INTERSHOP PRIMA' in u:
        return 'Intershop Prima Center'

    # 10. Prestasi Piranti Informasi
    if 'PRESTASI PIRANTI' in u:
        return 'Prestasi Piranti Informasi'

    # 11. Megalopolis Manunggal Industrial Development
    if 'MEGALOPOLIS MANUNGGAL' in u:
        return 'Megalopolis Manunggal Industrial Development'

    # 12. Mandiri Andal Sejahtera
    if 'MANDIRI ANDAL' in u or 'MAKMUR JAYA SERASI' in u:
        return 'Mandiri Andal Sejahtera'

    # 13. PCDC Propco One
    if 'PROPCO ONE' in u:
        return 'PCDC Propco One'

    # 14. Trans Indonesia Superkoridor
    if 'SUEPRKORIDOR' in u or 'SUPERKORIDOR' in u:
        return 'Trans Indonesia Superkoridor'

    # 15. Wisma Keiai Indonesia
    if 'WISMA KEIAI' in u:
        return 'Wisma Keiai Indonesia'

    # 16. BPJS Ketenagakerjaan
    if 'BPJS KETENAGAKERJAAN' in u and 'BINAJASA' not in u:
        return 'BPJS Ketenagakerjaan'

    # 17. APJII
    if u == 'APJII' or u == 'ASOSIASI PENYELENGGARA JASA INTERNET INDONESIA (APJII)':
        return 'Asosiasi Penyelenggara Jasa Internet Indonesia (APJII)'

    return None

cur.execute("SELECT id, pengelola FROM collo_records")
records = cur.fetchall()

updated = 0
for r in records:
    orig = r['pengelola']
    c_p = canonical_pengelola_extended(orig)
    if c_p and c_p != orig:
        cur.execute("UPDATE collo_records SET pengelola = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (c_p, r['id']))
        updated += 1

conn.commit()
print(f"Updated {updated} records in SQLite telecom_portal.db!")

# Read full updated dataset
cur.execute("SELECT * FROM collo_records ORDER BY id ASC")
collo_all = [dict(r) for r in cur.fetchall()]

cur.execute("SELECT * FROM sitac_records ORDER BY id ASC")
sitac_all = [dict(r) for r in cur.fetchall()]

cur.execute("SELECT * FROM gangguan_records ORDER BY id ASC")
gangguan_all = [dict(r) for r in cur.fetchall()]

conn.close()

# Sync to sitac_collo_data.json
json_path = 'sitac_collo_data.json'
existing_json = {}
if os.path.exists(json_path):
    with open(json_path, 'r', encoding='utf-8') as f:
        existing_json = json.load(f)

existing_json['collo_records'] = collo_all
existing_json['sitac_records'] = sitac_all
existing_json['gangguan_records'] = gangguan_all

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(existing_json, f, indent=2, ensure_ascii=False)

# Sync to sitac_collo_data.js
js_path = 'sitac_collo_data.js'
with open(js_path, 'w', encoding='utf-8') as f:
    f.write('window.SITAC_COLLO_DATA = ')
    json.dump(existing_json, f, indent=2, ensure_ascii=False)
    f.write(';\n')

print("Synced updated records to sitac_collo_data.json and sitac_collo_data.js successfully!")
