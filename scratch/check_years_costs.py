import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

c.execute("""
    SELECT 
        COALESCE(tahun, substr(date_pa, 1, 4)) as yr,
        COUNT(id) as count,
        SUM(biaya_permintaan_awal) as sum_awal,
        SUM(biaya_final) as sum_final,
        SUM(efisiensi_rupiah) as sum_ef,
        SUM(biaya_permintaan_awal) - SUM(biaya_final) as diff
    FROM sitac_records
    GROUP BY yr
    ORDER BY yr
""")
for r in c.fetchall():
    print(f"Year {r[0]}: count={r[1]}, awal={r[2]:,}, final={r[3]:,}, efisiensi={r[4]:,}, (awal-final)={r[5]:,}")
