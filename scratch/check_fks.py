import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute("SELECT name, sql FROM sqlite_master WHERE type='table'")
for r in c.fetchall():
    print('Table:', r[0])
    if 'references' in (r[1] or '').lower():
        print('  SQL:', r[1])
conn.close()
