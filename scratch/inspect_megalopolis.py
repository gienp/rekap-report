import openpyxl

wb = openpyxl.load_workbook('Rekap Collo x Interkoneksi 2024 V2 ROM 22 Nov(1).xlsx', data_only=True)
sheet = wb['Raw Data']

# Search for PT Megalopolis Manunggal across all rows
print("=== ALL ROWS WITH PT Megalopolis Manunggal ===")
for r in range(2, sheet.max_row + 1):
    pengelola = sheet.cell(row=r, column=2).value
    pelanggan = sheet.cell(row=r, column=3).value
    if pengelola and 'Megalopolis' in str(pengelola):
        so = sheet.cell(row=r, column=10).value
        start_val = sheet.cell(row=r, column=21).value
        end_val = sheet.cell(row=r, column=22).value
        status = sheet.cell(row=r, column=23).value
        print(f"Row {r:4d} | Pelanggan: {str(pelanggan)[:30]:30s} | Start: {str(start_val)[:10]} | End: {str(end_val)[:10]} | Status: {status} | SO: {so}")
