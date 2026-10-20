import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

c.execute("""
    SELECT id, no_pa, pelanggan, biaya_permintaan_awal, biaya_final, efisiensi_rupiah, efisiensi_persen, update_pekerjaan
    FROM sitac_records
    WHERE biaya_permintaan_awal > 0 AND efisiensi_rupiah != (biaya_permintaan_awal - biaya_final)
""")
for r in c.fetchall():
    print(r)
