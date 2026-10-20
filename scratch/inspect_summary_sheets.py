import openpyxl

wb = openpyxl.load_workbook('20241231_ Export Perizinan.xlsx', data_only=True)

for sname in ['Sum ALL Progress', '2024-1']:
    sheet = wb[sname]
    print(f"\n=== SHEET {sname} ===")
    for idx, r in enumerate(sheet.iter_rows(values_only=True)):
        if any(r):
            print(f"Row {idx+1}: {r[:10]}")
