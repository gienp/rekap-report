import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

c.execute("""
    SELECT 
        COUNT(id) as total_disp,
        COALESCE(SUM(biaya_permintaan_awal), 0) as sum_awal,
        COALESCE(SUM(biaya_final), 0) as sum_final,
        COALESCE(SUM(efisiensi_rupiah), 0) as sum_efisiensi
    FROM sitac_records
""")
r = c.fetchone()
print(f"Total rows: {r[0]}")
print(f"SUM(biaya_permintaan_awal): {r[1]:,}")
print(f"SUM(biaya_final): {r[2]:,}")
print(f"SUM(efisiensi_rupiah): {r[3]:,}")
print(f"sum_awal - sum_final = {r[1] - r[2]:,}")
print(f"Difference between sum_efisiensi and (sum_awal - sum_final): {r[3] - (r[1] - r[2]):,}")
