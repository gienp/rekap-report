import openpyxl
import sqlite3

wb = openpyxl.load_workbook('20241231_ Export Perizinan.xlsx', data_only=True)
sheet = wb['RAW data']
rows = list(sheet.iter_rows(values_only=True))

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute("SELECT no_pa, id, pelanggan, date_dispos, tahun FROM sitac_records")
existing = {row[0].strip().upper(): row for row in c.fetchall() if row[0]}

overlap = []
new_rows = []

for idx, r in enumerate(rows[1:], start=2):
    if r[19] == 2024:
        pa = str(r[1] or '').strip().upper()
        if pa in existing:
            overlap.append((r[1], existing[pa]))
        else:
            new_rows.append(r[1])

print(f"Total 2024 rows in Excel: {len(overlap) + len(new_rows)}")
print(f"Overlap with existing DB: {len(overlap)}")
print(f"New rows to add: {len(new_rows)}")

if overlap:
    print("\nOverlap sample:")
    for item in overlap[:5]:
        print("  Excel PA:", item[0], "vs Existing DB:", item[1])
