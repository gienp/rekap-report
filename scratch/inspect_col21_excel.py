import openpyxl

wb = openpyxl.load_workbook('Rekap Collo x Interkoneksi 2024 V2 ROM 22 Nov(1).xlsx', data_only=True)
sheet = wb['Raw Data']

# Let's inspect where "PT Solusi Jasa Teknologi" is in Excel
for r in range(2, sheet.max_row + 1):
    pengelola = sheet.cell(row=r, column=2).value
    pelanggan = sheet.cell(row=r, column=3).value
    if pengelola and 'Solusi Jasa Teknologi' in str(pengelola):
        start_cell = sheet.cell(row=r, column=21).value
        end_cell = sheet.cell(row=r, column=22).value
        status_cell = sheet.cell(row=r, column=23).value
        print(f"Row {r}: Pengelola={pengelola} | Pelanggan={pelanggan} | Col21(Start)={start_cell} | Col22(End)={end_cell} | Col23(Status)={status_cell}")
        break

# Let's inspect BUKALAPAK.COM with Mega Telekomunikasi
for r in range(2, sheet.max_row + 1):
    pengelola = sheet.cell(row=r, column=2).value
    pelanggan = sheet.cell(row=r, column=3).value
    if pengelola and 'Mega Telekomunikasi' in str(pengelola) and pelanggan and 'BUKALAPAK' in str(pelanggan):
        start_cell = sheet.cell(row=r, column=21).value
        end_cell = sheet.cell(row=r, column=22).value
        status_cell = sheet.cell(row=r, column=23).value
        print(f"Row {r}: Pengelola={pengelola} | Pelanggan={pelanggan} | Col21(Start)={start_cell} | Col22(End)={end_cell} | Col23(Status)={status_cell}")
        break

# Let's count how many rows in Col 21 (Start) have year >= 2027 in Excel!
count_col21_2027 = 0
for r in range(2, sheet.max_row + 1):
    val = sheet.cell(row=r, column=21).value
    if val and '2027' in str(val):
        count_col21_2027 += 1
print(f"\nTotal rows in Col 21 (Start Date) containing '2027': {count_col21_2027}")

# Let's check what values exist in Col 21 (Start Date)
from collections import Counter
start_years = Counter()
for r in range(2, sheet.max_row + 1):
    val = sheet.cell(row=r, column=21).value
    if val:
        yr = str(val)[:4]
        start_years[yr] += 1

print("\nCol 21 (Start Date) Years in Raw Data Excel:")
for yr, cnt in sorted(start_years.items()):
    print(f"  {yr}: {cnt}")
