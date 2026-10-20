import openpyxl

wb = openpyxl.load_workbook('Rekap Collo x Interkoneksi 2024 V2 ROM 22 Nov(1).xlsx', data_only=True)
sheet = wb['Raw Data']

print("=== ROWS IN EXCEL WHERE COL 21 (START DATE) CONTAINS 2027 ===")
for r in range(2, sheet.max_row + 1):
    val = sheet.cell(row=r, column=21).value
    if val and '2027' in str(val):
        pengelola = sheet.cell(row=r, column=2).value
        pelanggan = sheet.cell(row=r, column=3).value
        end_val = sheet.cell(row=r, column=22).value
        status = sheet.cell(row=r, column=23).value
        so = sheet.cell(row=r, column=10).value
        print(f"Row {r:4d} | Pengelola: {str(pengelola)[:25]:25s} | Pelanggan: {str(pelanggan)[:25]:25s} | Start: {val} | End: {end_val} | Status: {status}")
