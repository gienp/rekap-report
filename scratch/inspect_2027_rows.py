import sqlite3
import openpyxl

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

# Find rows where start_date starts with 2027
c.execute("""
    SELECT id, pengelola, pelanggan, no_so, sid, start_date, end_date, rev_sewa_tahun, keterangan
    FROM collo_records
    WHERE start_date LIKE '2027%'
    LIMIT 20
""")
rows_2027 = c.fetchall()

print(f"Total rows in telecom_portal.db with start_date LIKE '2027%':")
c.execute("SELECT count(*) FROM collo_records WHERE start_date LIKE '2027%'")
print(c.fetchone()[0])

print("\n--- SAMPLE 10 ROWS WITH START_DATE = 2027 ---")
for r in rows_2027[:10]:
    print(f"ID: {r[0]} | Pengelola: {r[1]} | Pelanggan: {r[2]} | Start: {r[5]} | End: {r[6]} | SO: {r[3]}")
    print(f"   Keterangan: {r[8]}")

# Also check backup and raw db
c_raw = sqlite3.connect('network_infrastructure.db').cursor()
c_raw.execute("SELECT count(*) FROM collo_records WHERE start_date LIKE '2027%'")
print(f"\nIn network_infrastructure.db (raw import): {c_raw.fetchone()[0]}")
