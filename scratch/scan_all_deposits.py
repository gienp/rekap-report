import openpyxl

wb = openpyxl.load_workbook('Rekap Collo x Interkoneksi 2024 V2 ROM 22 Nov(1).xlsx', data_only=True, read_only=True)
ws = wb['Raw Data']

deposit_rows = []
for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
    val = row[16] # Col 17 is index 16
    if val is not None:
        s_val = str(val).strip()
        if s_val and s_val not in ['-', '0', 'None']:
            deposit_rows.append({
                'row': i,
                'no_so': row[9] if len(row) > 9 else '',
                'pelanggan': row[2] if len(row) > 2 else '',
                'val': val
            })

print(f"Total non-blank deposit rows in Excel Raw Data: {len(deposit_rows)}")
for d in deposit_rows:
    print(d)
