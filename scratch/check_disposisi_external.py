import openpyxl
import sqlite3

wb = openpyxl.load_workbook('20241231_ Export Perizinan.xlsx', data_only=True)
sheet = wb['DISPOSISI EXTERNAL ']
rows = list(sheet.iter_rows(values_only=True))

print("=== DISPOSISI EXTERNAL ROWS ===")
print("Header:", rows[0])
for idx, r in enumerate(rows[1:], start=1):
    if any(r):
        print(f"Row {idx}: {r}")

print("\n=== CURRENT gangguan_records in telecom_portal.db ===")
conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute("SELECT COUNT(*), MIN(tgl_dispos), MAX(tgl_dispos) FROM gangguan_records")
print("gangguan_records summary:", c.fetchone())
c.execute("SELECT DISTINCT substr(tgl_dispos, 1, 4), COUNT(*) FROM gangguan_records GROUP BY substr(tgl_dispos, 1, 4)")
print("gangguan_records by year:", c.fetchall())
