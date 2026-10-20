import sqlite3, re

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute("SELECT DISTINCT pengelola FROM collo_records ORDER BY pengelola")
all_p = [r[0] for r in c.fetchall()]

# Group by normalized lowercase alphanum
groups = {}
for p in all_p:
    k = re.sub(r'[^a-z0-9]', '', p.lower())
    groups.setdefault(k, []).append(p)

print("Duplicates by simple strip/casing:")
for k, v in groups.items():
    if len(v) > 1:
        print(" ", v)
