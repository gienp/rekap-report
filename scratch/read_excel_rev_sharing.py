import openpyxl

wb = openpyxl.load_workbook('Rekap Collo x Interkoneksi 2024 V2 ROM 22 Nov(1).xlsx', data_only=True, read_only=True)
ws = wb['Detail1']

rev_sharing_col = None
rows_iter = ws.iter_rows(values_only=True)
header = next(rows_iter)
for idx, col in enumerate(header):
    if col and 'rev sharing' in str(col).lower():
        rev_sharing_col = idx
        print(f"Found column at index {idx}: {repr(col)}")
        break

sample_values = []
count = 0
for row in rows_iter:
    val = row[rev_sharing_col] if rev_sharing_col < len(row) else None
    if val is not None and str(val).strip() not in ['', '-']:
        count += 1
        if len(sample_values) < 20:
            sample_values.append(val)

print(f"Total non-empty values in Excel: {count}")
print("Sample raw values from Excel:")
for v in sample_values:
    print(f"  type={type(v).__name__}, value={repr(v)}")
