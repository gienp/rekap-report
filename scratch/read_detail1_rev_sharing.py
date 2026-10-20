import openpyxl

wb = openpyxl.load_workbook('Rekap Collo x Interkoneksi 2024 V2 ROM 22 Nov(1).xlsx', data_only=True, read_only=True)
ws = wb['Detail1']

samples = []
for r_idx, row in enumerate(ws.iter_rows(min_row=4, values_only=True)):
    val = row[19] # Col 20 (0-indexed 19)
    if val is not None and str(val).strip() not in ['', '-']:
        pelanggan = row[2] if len(row) > 2 else ''
        pengelola = row[1] if len(row) > 1 else ''
        samples.append((r_idx+4, pengelola, pelanggan, type(val).__name__, val))
        if len(samples) >= 20:
            break

print(f"Found {len(samples)} samples:")
for r_num, peng, pel, vtype, val in samples:
    print(f"Row {r_num} | {peng} | {pel} | {vtype}: {repr(val)}")
