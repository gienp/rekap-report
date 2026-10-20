import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

c.execute("SELECT jenis_sewa, count(*) FROM collo_records GROUP BY jenis_sewa")
print("Collo jenis_sewa:", c.fetchall())

c.execute("SELECT progress, count(*) FROM sitac_records GROUP BY progress")
print("Sitac progress:", c.fetchall())
