import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

c.execute("""
    SELECT id, no_pa, pelanggan, tahun, biaya_permintaan_awal, biaya_final, efisiensi_rupiah, efisiensi_persen,
           (biaya_permintaan_awal - biaya_final) as diff,
           update_pekerjaan
    FROM sitac_records
    WHERE (tahun IN (2025, 2026) OR date_pa LIKE '2025%' OR date_pa LIKE '2026%')
      AND efisiensi_rupiah != (biaya_permintaan_awal - biaya_final)
    ORDER BY abs(efisiensi_rupiah - (biaya_permintaan_awal - biaya_final)) DESC
""")
rows = c.fetchall()
print(f"Total mismatch rows in 2025 & 2026: {len(rows)}")

for r in rows[:25]:
    print(f"\nID: {r[0]} | PA: {r[1]} | Thn: {r[3]} | Pelanggan: {r[2]}")
    print(f"  Awal: {r[4]:,} | Final: {r[5]:,} | Efisiensi DB: {r[6]:,} | (Awal-Final): {r[8]:,}")
    print(f"  Update text: {str(r[9])[:150]}")
