import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

c.execute("""
    SELECT 
        SUM(CASE WHEN biaya_permintaan_awal = 0 AND biaya_final > 0 THEN biaya_final ELSE 0 END) as final_when_awal_zero,
        SUM(CASE WHEN biaya_permintaan_awal > 0 THEN biaya_permintaan_awal ELSE 0 END) as awal_when_awal_gt_zero,
        SUM(CASE WHEN biaya_permintaan_awal > 0 THEN biaya_final ELSE 0 END) as final_when_awal_gt_zero,
        SUM(CASE WHEN biaya_permintaan_awal > 0 THEN efisiensi_rupiah ELSE 0 END) as ef_when_awal_gt_zero,
        SUM(efisiensi_rupiah) as total_efisiensi
    FROM sitac_records
""")
r = c.fetchone()
print(f"Final when Awal == 0: {r[0]:,}")
print(f"Awal when Awal > 0: {r[1]:,}")
print(f"Final when Awal > 0: {r[2]:,}")
print(f"Awal - Final (for rows where Awal > 0): {r[1] - r[2]:,}")
print(f"Efisiensi when Awal > 0: {r[3]:,}")
print(f"Total Efisiensi across all rows: {r[4]:,}")
