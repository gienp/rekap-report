import openpyxl

wb = openpyxl.load_workbook("Report Sitac  2026 FIX.xlsx", read_only=True, data_only=True)
print("Sheets in Report Sitac 2026 FIX:", wb.sheetnames)

ws = wb["Report SITAC"]
headers = [cell for cell in next(ws.iter_rows(values_only=True))]
print("Headers count:", len(headers))
for i, h in enumerate(headers):
    if h and any(k in str(h).lower() for k in ['biaya', 'awal', 'akhir', 'final', 'efesiensi', 'efisiensi', 'pa', 'pelanggan']):
        print(f"Col {i}: {h}")
