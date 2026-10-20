import sqlite3

c = sqlite3.connect('network_infrastructure.db').cursor()
rows = c.execute("SELECT id, pengelola, pelanggan, no_so, start_date, end_date, status FROM collo_records WHERE pengelola LIKE '%Megalopolis%'").fetchall()

print(f"Total Megalopolis rows in DB: {len(rows)}")
for r in rows:
    print(f"ID {r[0]:4d} | Pelanggan: {r[2][:30]:30s} | Start: {r[4]} | End: {r[5]} | Status: {r[6]} | SO: {r[3]}")
