import sqlite3

conn = sqlite3.connect('telecom_portal.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute('''
    SELECT id, no_pa, terminating, ptl, biaya_permintaan_awal, biaya_final, efisiensi_rupiah, efisiensi_persen, update_pekerjaan 
    FROM sitac_records 
    WHERE biaya_permintaan_awal > 0 AND (biaya_final == 0 OR biaya_final IS NULL)
''')
rows = cur.fetchall()
print(f"Total rows where biaya_permintaan_awal > 0 and biaya_final == 0: {len(rows)}")
for r in rows:
    print("="*60)
    print(f"ID {r['id']} | PA: {r['no_pa']} | Term: {r['terminating']}")
    print(f"Awal: {r['biaya_permintaan_awal']:,} | Final: {r['biaya_final']}")
    print(f"Text snippet: {(r['update_pekerjaan'] or '')[:300]}")
