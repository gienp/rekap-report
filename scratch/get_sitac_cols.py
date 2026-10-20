import sqlite3
conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute("PRAGMA table_info(sitac_records)")
cols = [r[1] for r in c.fetchall()]
print("Columns in sitac_records:", cols)
