import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = c.fetchall()
print('Tables in telecom_portal.db:', tables)

for t in tables:
    name = t[0]
    c.execute(f"SELECT count(*) FROM {name}")
    cnt = c.fetchone()[0]
    print(f"Table {name}: {cnt} rows")
