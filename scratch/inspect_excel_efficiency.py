import openpyxl

wb = openpyxl.load_workbook("Report Sitac  2026 FIX.xlsx", read_only=True, data_only=True)

print("=== SHEET: Rekap Efesiensi Biaya Perijinan ===")
ws = wb["Rekap Efesiensi Biaya Perijinan"]
for row in ws.iter_rows(values_only=True):
    if any(row):
        print([str(c)[:30] if c is not None else '' for c in row[:10]])

print("\n=== SHEET: DATA AWALDAN AHIR BIAYA ===")
ws2 = wb["DATA AWALDAN AHIR BIAYA"]
count = 0
for row in ws2.iter_rows(values_only=True):
    if any(row):
        print([str(c)[:25] if c is not None else '' for c in row[:8]])
        count += 1
        if count >= 15:
            break
