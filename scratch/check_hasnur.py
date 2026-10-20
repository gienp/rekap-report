import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute("SELECT id, no_so, pelanggan, status, rev_sewa_tahun, biaya_deposit FROM collo_records WHERE no_so LIKE '%A311202001848%' OR pelanggan LIKE '%Hasnur%'")
rows = c.fetchall()
print("Found Hasnur in DB:", len(rows))
for r in rows:
    print(" ", r)
