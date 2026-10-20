import openpyxl

wb = openpyxl.load_workbook('20241231_ Export Perizinan.xlsx', data_only=True)
sheet = wb['RAW data']
rows = list(sheet.iter_rows(values_only=True))
header = rows[0]

rows_with_cost = []
for idx, r in enumerate(rows[1:], start=2):
    if r[19] == 2024:
        otc = r[9]
        sewa = r[10]
        if (otc is not None and otc != 0 and otc != '') or (sewa is not None and sewa != 0 and sewa != ''):
            rows_with_cost.append((idx, r[1], r[2], r[8], otc, sewa, r[11]))

print(f"Total 2024 rows with cost: {len(rows_with_cost)}")
for item in rows_with_cost[:10]:
    print(" ", item)
