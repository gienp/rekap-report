import openpyxl

wb = openpyxl.load_workbook('Rekap Collo x Interkoneksi 2024 V2 ROM 22 Nov(1).xlsx', data_only=True, read_only=True)
ws = wb['Detail1']

for r_idx, row in enumerate(ws.iter_rows(max_row=10, values_only=True)):
    for c_idx, val in enumerate(row):
        if val and 'share' in str(val).lower() or (val and 'sharing' in str(val).lower()):
            print(f"Row {r_idx+1}, Col {c_idx+1}: {repr(val)}")
