import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute("PRAGMA table_info(users)")
cols = [col[1] for col in c.fetchall()]

if 'team_role' not in cols:
    c.execute("ALTER TABLE users ADD COLUMN team_role TEXT DEFAULT ''")
    conn.commit()
    print("Added team_role column!")

if 'email' not in cols:
    c.execute("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''")
    conn.commit()
    print("Added email column!")

c.execute("PRAGMA table_info(users)")
print("Final columns:", [col[1] for col in c.fetchall()])
