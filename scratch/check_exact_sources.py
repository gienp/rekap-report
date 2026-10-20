import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute("SELECT id, no_pa, pelanggan, terminating, latitude, longitude, coord_type FROM sitac_records WHERE coord_type IN ('EXACT', 'EXACT_COORDS', 'USER_INPUT')")
rows = c.fetchall()
print(f"Total exact rows in DB: {len(rows)}")
for r in rows[:15]:
    print(f"ID {r[0]} | PA: {r[1]} | Pelanggan: {r[2]} | Terminating: {r[3]} | Coords: ({r[4]}, {r[5]}) | Type: {r[6]}")

# Also check how many have actual numbers in terminating or where coords came from
import re
coord_regex = re.compile(r'(-?[0-8]\.\d{3,8})[,\s/]+(10[5-8]\.\d{3,8})')
explicit_in_term = [r for r in rows if coord_regex.search(str(r[3]))]
print(f"Records with explicit tikor inside terminating text: {len(explicit_in_term)}")

conn.close()
