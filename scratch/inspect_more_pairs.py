import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

checks = ['makmur jaya', 'mandiri andal', 'megalopolis', 'propco', 'suepr', 'keiai']
for ch in checks:
    c.execute(f"SELECT id, pengelola, pelanggan, no_so FROM collo_records WHERE LOWER(pengelola) LIKE '%{ch}%'")
    res = c.fetchall()
    print(f"\n--- Check for '{ch}' ---")
    for r in res:
        print(" ", r)
