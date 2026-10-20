import openpyxl
import re
import sqlite3

coord_regex = re.compile(r'(-?\d{1,2}\.\d+)\s*,\s*(\d{2,3}\.\d+)')

print("=== 1. Inspecting Report Sitac 2026 FIX.xlsx ===")
wb26 = openpyxl.load_workbook('Report Sitac  2026 FIX.xlsx', data_only=True)
ws_m = wb26['Master RAW data']
rows26 = list(ws_m.iter_rows(values_only=True))[1:]

real_2026_coords = {}
for idx, r in enumerate(rows26, start=1):
    no_pa = str(r[1] or '').strip()
    term = str(r[7] or '').strip()
    k_pel = str(r[8] or '').strip()
    
    # Check if either col 8 or terminating text has actual coordinates
    m1 = coord_regex.search(k_pel)
    m2 = coord_regex.search(term)
    if m1:
        lat, lng = float(m1.group(1)), float(m1.group(2))
        real_2026_coords[no_pa or f"ROW_{idx}"] = (lat, lng, 'EXCEL_COL_8')
    elif m2:
        lat, lng = float(m2.group(1)), float(m2.group(2))
        real_2026_coords[no_pa or f"ROW_{idx}"] = (lat, lng, 'EXCEL_TERMINATING_TEXT')

print(f"Total rows in 2026 FIX: {len(rows26)}")
print(f"Rows with real coordinates in 2026 FIX: {len(real_2026_coords)}")
for k, v in list(real_2026_coords.items())[:10]:
    print(f"  PA: {k} -> {v}")

print("\n=== 2. Inspecting 20241231_ Export Perizinan.xlsx ===")
wb24 = openpyxl.load_workbook('20241231_ Export Perizinan.xlsx', data_only=True)
ws24 = wb24.active
rows24 = list(ws24.iter_rows(values_only=True))[1:]

real_2024_coords = {}
for idx, r in enumerate(rows24, start=1):
    # Year in col 19
    yr = r[19]
    if yr == 2024:
        no_pa = str(r[1] or '').strip()
        term = str(r[6] or '').strip()
        k_pel = str(r[7] or '').strip()
        m1 = coord_regex.search(k_pel)
        m2 = coord_regex.search(term)
        if m1:
            lat, lng = float(m1.group(1)), float(m1.group(2))
            real_2024_coords[no_pa or f"ROW24_{idx}"] = (lat, lng, 'EXCEL_2024_COL_7')
        elif m2:
            lat, lng = float(m2.group(1)), float(m2.group(2))
            real_2024_coords[no_pa or f"ROW24_{idx}"] = (lat, lng, 'EXCEL_2024_TERM_TEXT')

print(f"Total 2024 rows in Export Perizinan: {sum(1 for r in rows24 if r[19] == 2024)}")
print(f"2024 rows with real coordinates: {len(real_2024_coords)}")

print("\n=== 3. Current DB Status in telecom_portal.db ===")
conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute("SELECT COUNT(*), COUNT(latitude), COUNT(CASE WHEN coord_type IN ('EXACT', 'EXACT_COORDS') THEN 1 END) FROM sitac_records")
tot, with_lat, exact_lat = c.fetchone()
print(f"Total DB records: {tot}")
print(f"DB records with latitude: {with_lat}")
print(f"DB records with coord_type in ('EXACT', 'EXACT_COORDS'): {exact_lat}")

conn.close()
