import sqlite3

conn = sqlite3.connect('telecom_portal.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

ids_to_check = [489, 524, 525, 528, 537, 549]

for i in ids_to_check:
    cur.execute("SELECT id, no_pa, terminating, biaya_permintaan_awal, biaya_final, efisiensi_rupiah, efisiensi_persen, update_pekerjaan FROM sitac_records WHERE id = ?", (i,))
    r = cur.fetchone()
    if r:
        print("="*80)
        print(f"ID: {r['id']} | PA: {r['no_pa']} | Term: {r['terminating']}")
        print(f"DB -> Awal: {r['biaya_permintaan_awal']:,} | Final: {r['biaya_final']:,} | Hemat: {r['efisiensi_rupiah']:,} | %: {r['efisiensi_persen']}%")
        print("UPDATE TEXT:")
        print(r['update_pekerjaan'])
