import sqlite3
import json
import os

DB_PATH = 'telecom_portal.db'
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

updates = [
    {
        'id': 489,
        'no_pa': 'A821103000308-2',
        'biaya_permintaan_awal': 35000000,
        'biaya_final': 15000000,
        'efisiensi_rupiah': 20000000,
        'efisiensi_persen': 57.14,
        'is_berbiaya': 1,
        'note': '35jt to 15jt as per field negotiation note'
    },
    {
        'id': 549,
        'no_pa': 'A821103000442',
        'biaya_permintaan_awal': 20000000,
        'biaya_final': 7500000,
        'efisiensi_rupiah': 12500000,
        'efisiensi_persen': 62.5,
        'is_berbiaya': 1,
        'note': '20jt to 7.5jt RW 11 Pegadungan Kalideres'
    },
    {
        'id': 5,
        'no_pa': 'A111401003763',
        'biaya_permintaan_awal': 5000000,
        'biaya_final': 2500000,
        'efisiensi_rupiah': 2500000,
        'efisiensi_persen': 50.0,
        'is_berbiaya': 1,
        'note': 'awal 5jt akhir 2.5jt'
    },
    {
        'id': 50,
        'no_pa': 'A111401004680',
        'biaya_permintaan_awal': 12000000,
        'biaya_final': 5000000,
        'efisiensi_rupiah': 7000000,
        'efisiensi_persen': 58.33,
        'is_berbiaya': 1,
        'note': 'awal 12jt kontribusi 5jt'
    },
    {
        'id': 84,
        'no_pa': 'A811202000693',
        'biaya_permintaan_awal': 2500000,
        'biaya_final': 1000000,
        'efisiensi_rupiah': 1500000,
        'efisiensi_persen': 60.0,
        'is_berbiaya': 1,
        'note': 'awal 2.5jt koordinasi 1jt'
    },
    {
        'id': 115,
        'no_pa': 'A111303007109',
        'biaya_permintaan_awal': 6000000,
        'biaya_final': 3000000,
        'efisiensi_rupiah': 3000000,
        'efisiensi_persen': 50.0,
        'is_berbiaya': 1,
        'note': 'awal 6jt koordinasi PIC Wawan 3jt'
    },
    {
        'id': 200,
        'no_pa': 'A822204006924',
        'biaya_permintaan_awal': 2000000,
        'biaya_final': 500000,
        'efisiensi_rupiah': 1500000,
        'efisiensi_persen': 75.0,
        'is_berbiaya': 1,
        'note': 'awal 2jt kontribusi 500rb'
    },
    {
        'id': 225,
        'no_pa': 'NON PA',
        'biaya_permintaan_awal': 3000000,
        'biaya_final': 1500000,
        'efisiensi_rupiah': 1500000,
        'efisiensi_persen': 50.0,
        'is_berbiaya': 1,
        'note': 'awal 3jt koordinasi 1.5jt'
    },
    {
        'id': 537,
        'no_pa': 'A821103000398',
        'biaya_permintaan_awal': 15000000,
        'biaya_final': 6000000,
        'efisiensi_rupiah': 9000000,
        'efisiensi_persen': 60.0,
        'is_berbiaya': 1,
        'note': 'awal 15jt nego menjadi 6jt PU Binus'
    },
    {
        'id': 525,
        'no_pa': 'A821103000364',
        'biaya_permintaan_awal': 25000000,
        'biaya_final': 7500000,
        'efisiensi_rupiah': 17500000,
        'efisiensi_persen': 70.0,
        'is_berbiaya': 1,
        'note': 'awal 25jt nego menjadi 7.5jt RW 05 Puri Cinere'
    },
    {
        'id': 528,
        'no_pa': 'A821103000322',
        'biaya_permintaan_awal': 10000000,
        'biaya_final': 8000000,
        'efisiensi_rupiah': 2000000,
        'efisiensi_persen': 20.0,
        'is_berbiaya': 1,
        'note': 'awal 10jt (7jt+3jt) deal 8jt (5jt+3jt) RW 07 & RW 13 Harapan Jaya'
    }
]

print("Applying updates to telecom_portal.db...")
for u in updates:
    cur.execute('''
        UPDATE sitac_records
        SET biaya_permintaan_awal = ?,
            biaya_final = ?,
            efisiensi_rupiah = ?,
            efisiensi_persen = ?,
            is_berbiaya = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (u['biaya_permintaan_awal'], u['biaya_final'], u['efisiensi_rupiah'], u['efisiensi_persen'], u['is_berbiaya'], u['id']))
    print(f"Updated ID {u['id']} ({u['no_pa']}): Awal={u['biaya_permintaan_awal']:,}, Final={u['biaya_final']:,}, Efisiensi={u['efisiensi_rupiah']:,} ({u['efisiensi_persen']}%) - {u['note']}")

conn.commit()

# Now sync telecom_portal.db to sitac_collo_data.json and sitac_collo_data.js
cur.execute("SELECT * FROM sitac_records ORDER BY id ASC")
sitac_all = [dict(r) for r in cur.fetchall()]

cur.execute("SELECT * FROM collo_records ORDER BY id ASC")
collo_all = [dict(r) for r in cur.fetchall()]

cur.execute("SELECT * FROM gangguan_records ORDER BY id ASC")
gangguan_all = [dict(r) for r in cur.fetchall()]

conn.close()

# Update JSON
json_path = 'sitac_collo_data.json'
existing_json = {}
if os.path.exists(json_path):
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            existing_json = json.load(f)
    except Exception as e:
        print("Warning reading json:", e)

existing_json['sitac_records'] = sitac_all
existing_json['collo_records'] = collo_all
existing_json['gangguan_records'] = gangguan_all

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(existing_json, f, indent=2, ensure_ascii=False)
print("Updated sitac_collo_data.json successfully.")

# Update JS
js_path = 'sitac_collo_data.js'
with open(js_path, 'w', encoding='utf-8') as f:
    f.write('window.SITAC_COLLO_DATA = ')
    json.dump(existing_json, f, indent=2, ensure_ascii=False)
    f.write(';\n')
print("Updated sitac_collo_data.js successfully.")
