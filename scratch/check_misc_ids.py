import sqlite3

conn = sqlite3.connect('telecom_portal.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

for i in [50, 67, 171, 222]:
    cur.execute("SELECT id, no_pa, terminating, biaya_permintaan_awal, biaya_final, efisiensi_rupiah, efisiensi_persen, update_pekerjaan FROM sitac_records WHERE id = ?", (i,))
    r = cur.fetchone()
    if r:
        print("="*60)
        print(f"ID {r['id']} | PA: {r['no_pa']}")
        print(f"DB -> Awal: {r['biaya_permintaan_awal']:,} | Final: {r['biaya_final']:,}")
        print("Text:", r['update_pekerjaan'])
