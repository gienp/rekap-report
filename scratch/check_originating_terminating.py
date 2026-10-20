import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute("SELECT id, pengelola, pelanggan, originating, terminating, alamat_pengelola FROM collo_records WHERE length(originating) > 0 OR length(terminating) > 0 LIMIT 15")
rows = c.fetchall()
print(f"Sample rows with originating/terminating ({len(rows)} rows):")
for r in rows:
    print(f"ID {r[0]} | Pengelola: {r[1]} | Pelanggan: {r[2]} | Originating: {r[3]} | Terminating: {r[4]} | Alamat: {r[5]}")

c.execute("SELECT COUNT(*) FROM collo_records WHERE length(originating) > 0 OR length(terminating) > 0")
print("Total rows with originating or terminating:", c.fetchone()[0])
