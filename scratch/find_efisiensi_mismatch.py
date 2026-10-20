import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

c.execute("""
    SELECT id, no_pa, pelanggan, biaya_permintaan_awal, biaya_final, efisiensi_rupiah, efisiensi_persen,
           (biaya_permintaan_awal - biaya_final) as expected_efisiensi,
           (efisiensi_rupiah - (biaya_permintaan_awal - biaya_final)) as diff,
           update_pekerjaan
    FROM sitac_records
    WHERE efisiensi_rupiah != (biaya_permintaan_awal - biaya_final)
    ORDER BY abs(diff) DESC
""")
rows = c.fetchall()
print(f"Total rows with mismatch: {len(rows)}")

for r in rows[:30]:
    print(f"\nID: {r[0]} | PA: {r[1]} | Pelanggan: {r[2]}")
    print(f"  Awal: {r[3]:,} | Final: {r[4]:,} | DB Efisiensi: {r[5]:,} | Expected (Awal-Final): {r[7]:,} | Diff: {r[8]:,}")
    print(f"  Text preview: {str(r[9])[:120]}")
