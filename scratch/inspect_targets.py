import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

targets = [
    'caltumas', 'caturmas', 'indointernet', 'indo internet',
    'infranstruktur', 'infrastruktur cakrawala',
    'internetindo data centra', 'cricis center', 'crisis menara',
    'data sinergitama', 'elitery', 'dist jaya ap bulungan', 'dist.jaya'
]

for t in targets:
    c.execute(f"SELECT id, pengelola, pelanggan, no_so FROM collo_records WHERE LOWER(pengelola) LIKE '%{t}%'")
    res = c.fetchall()
    if res:
        print(f"\n--- Matches for '{t}' ({len(res)} rows) ---")
        for r in res:
            print(" ", r)
