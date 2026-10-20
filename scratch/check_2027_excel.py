import openpyxl

wb = openpyxl.load_workbook('Rekap Collo x Interkoneksi 2024 V2 ROM 22 Nov(1).xlsx', data_only=True)
sheet = wb['Raw Data']

# Let's find PT Solusi Jasa Teknologi or BUKALAPAK.COM or row with 2027
headers = [cell.value for cell in sheet[1]]
print("Headers in Raw Data:")
for i, h in enumerate(headers):
    if h:
        print(f"Col {i+1}: {h}")

print("\n--- SEARCHING FOR ROWS WITH 2027 OR SOLUSI JASA TEKNOLOGI ---")
count_2027 = 0
for row_idx in range(2, sheet.max_row + 1):
    pengelola = sheet.cell(row=row_idx, column=2).value
    pelanggan = sheet.cell(row=row_idx, column=3).value
    start_val = sheet.cell(row=row_idx, column=24).value # let's check which column is start date
    end_val = sheet.cell(row=row_idx, column=25).value
    
    # Check all cells in row for 2027
    row_vals = [sheet.cell(row=row_idx, column=c).value for c in range(1, 30)]
    for c_idx, val in enumerate(row_vals):
        val_str = str(val) if val else ''
        if '2027' in val_str:
            count_2027 += 1
            if count_2027 <= 5:
                print(f"Row {row_idx}: Col {c_idx+1} has 2027: {val}")
                print(f"   Pengelola: {pengelola}, Pelanggan: {pelanggan}")
                print(f"   Row sample: {row_vals[1:6]}")
                print(f"   Col 20..26: {row_vals[20:26]}")
            break

print(f"\nTotal rows with '2027' in Excel: {count_2027}")
