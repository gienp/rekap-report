import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

ids_to_check = [487, 490, 491, 506, 512, 522, 523, 538, 563]

for rec_id in ids_to_check:
    c.execute("SELECT id, no_pa, pelanggan, terminating, biaya_permintaan_awal, biaya_final, efisiensi_rupiah, efisiensi_persen, update_pekerjaan FROM sitac_records WHERE id = ?", (rec_id,))
    r = c.fetchone()
    if r:
        print(f"\n=======================================================")
        print(f"ID: {r[0]} | PA: {r[1]} | Pelanggan: {r[2]}")
        print(f"Current Awal: {r[4]:,} | Final: {r[5]:,} | Efisiensi: {r[6]:,}")
        print(f"Update Pekerjaan:\n{r[8]}")
