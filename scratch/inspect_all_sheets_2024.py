import openpyxl
from collections import Counter

wb = openpyxl.load_workbook('20241231_ Export Perizinan.xlsx', data_only=True)

for name in wb.sheetnames:
    sheet = wb[name]
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        continue
    print(f"\n================ SHEET: {name} (Rows: {len(rows)}) ================")
    # Print first 3 rows
    for i in range(min(4, len(rows))):
        print(f"Row {i+1}: {rows[i][:12]}")
