import sqlite3

conn = sqlite3.connect('telecom_portal.db')
cursor = conn.cursor()
cursor.execute("SELECT id, pengelola, rev_sharing, rev_sharing_pct, rev_sharing_raw FROM collo_records WHERE rev_sharing IS NOT NULL AND rev_sharing != '' LIMIT 10")
for row in cursor.fetchall():
    print(row)
conn.close()
