import openpyxl

wb = openpyxl.load_workbook('Rekap Collo x Interkoneksi 2024 V2 ROM 22 Nov(1).xlsx', data_only=True)
sheet = wb['Raw Data']

row_2515 = [sheet.cell(row=2515, column=c).value for c in range(1, 46)]
headers = [sheet.cell(row=1, column=c).value for c in range(1, 46)]

print("=== DETAIL ROW 2515 (PT Megalopolis Manunggal - PT ASTRA OTOPARTS) ===")
for h, val in zip(headers, row_2515):
    if val:
        print(f"  {str(h).replace(chr(10), ' '):35s}: {val}")

row_2275 = [sheet.cell(row=2275, column=c).value for c in range(1, 46)]
print("\n=== DETAIL ROW 2275 (PT Mega Telekomunikasi Indonesia - BUKALAPAK.COM) ===")
for h, val in zip(headers, row_2275):
    if val:
        print(f"  {str(h).replace(chr(10), ' '):35s}: {val}")
