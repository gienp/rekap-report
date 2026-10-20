import openpyxl

wb = openpyxl.load_workbook('Rekap Collo x Interkoneksi 2024 V2 ROM 22 Nov(1).xlsx', data_only=True, read_only=True)

for sname in wb.sheetnames:
    ws = wb[sname]
    rev_col = None
    for r_idx, row in enumerate(ws.iter_rows(max_row=5, values_only=True)):
        for c_idx, val in enumerate(row):
            if val and ('share' in str(val).lower() or 'bagi hasil' in str(val).lower()):
                rev_col = (r_idx+1, c_idx)
                break
        if rev_col:
            break
            
    if rev_col:
        header_row, col_idx = rev_col
        count = 0
        samples = []
        for row in ws.iter_rows(min_row=header_row+1, values_only=True):
            if col_idx < len(row):
                v = row[col_idx]
                if v is not None and str(v).strip() not in ['', '-']:
                    count += 1
                    if len(samples) < 5:
                        samples.append(v)
        print(f"Sheet '{sname}': header at row {header_row}, col {col_idx+1} | non-empty rows: {count}")
        print("  Sample values:", samples)
