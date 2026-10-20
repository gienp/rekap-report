import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute("SELECT id, no_pa, pelanggan, terminating, latitude, longitude, coord_type, tahun FROM sitac_records WHERE coord_type = 'EXACT'")
rows = c.fetchall()
print(f"Total EXACT rows: {len(rows)}")

# Check years
years = {}
for r in rows:
    years[r[7]] = years.get(r[7], 0) + 1
print("Years of EXACT rows:", years)

# Check if terminating has coordinates
import re
coord_regex = re.compile(r'(-?\d{1,2}\.\d+)\s*,\s*(\d{2,3}\.\d+)')
with_coords_in_term = [r for r in rows if coord_regex.search(str(r[3]))]
print(f"EXACT rows with coordinates in terminating text: {len(with_coords_in_term)}")

for r in rows[:5]:
    print(f"ID: {r[0]}, PA: {r[1]}, Pelanggan: {r[2][:25]}, Terminating: {r[3][:40]}, Lat: {r[4]}, Lng: {r[5]}")

conn.close()
