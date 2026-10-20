import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

c.execute("PRAGMA table_info(sitac_records);")
sitac_cols = [r[1] for r in c.fetchall()]
print("sitac_records columns:", sitac_cols)

c.execute("PRAGMA table_info(gangguan_records);")
gangguan_cols = [r[1] for r in c.fetchall()]
print("gangguan_records columns:", gangguan_cols)

c.execute("SELECT * FROM sitac_records LIMIT 2")
print("\nsitac_records sample:\n", c.fetchall())

c.execute("SELECT * FROM gangguan_records LIMIT 2")
print("\ngangguan_records sample:\n", c.fetchall())
