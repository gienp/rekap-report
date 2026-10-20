import openpyxl
import datetime
from collections import Counter

wb = openpyxl.load_workbook('20241231_ Export Perizinan.xlsx', data_only=True)
sheet = wb['RAW data']
rows = list(sheet.iter_rows(values_only=True))
header = rows[0]

th_idx = None
dispos_idx = None
for i, col in enumerate(header):
    if col and col.strip().upper() == 'TAHUN':
        th_idx = i
    if col and 'DISPOS' in col.upper():
        dispos_idx = i

print(f"TAHUN col index: {th_idx}, TGL DISPOS col index: {dispos_idx}")

rows_2024_by_tahun_col = []
rows_2024_by_dispos_date = []

for idx, r in enumerate(rows[1:], start=2):
    tahun_val = r[th_idx] if th_idx is not None else None
    dispos_val = r[dispos_idx] if dispos_idx is not None else None
    
    dispos_year = None
    if isinstance(dispos_val, (datetime.datetime, datetime.date)):
        dispos_year = dispos_val.year
    elif isinstance(dispos_val, str) and len(dispos_val) >= 4:
        for y in [2022, 2023, 2024, 2025, 2026]:
            if str(y) in dispos_val:
                dispos_year = y
                break

    if tahun_val == 2024:
        rows_2024_by_tahun_col.append((idx, r, dispos_year))
    if dispos_year == 2024:
        rows_2024_by_dispos_date.append((idx, r, tahun_val))

print(f"Rows where TAHUN col == 2024: {len(rows_2024_by_tahun_col)}")
print(f"Rows where TGL DISPOS year == 2024: {len(rows_2024_by_dispos_date)}")

# Check discrepancy
by_th = set(x[0] for x in rows_2024_by_tahun_col)
by_dp = set(x[0] for x in rows_2024_by_dispos_date)
print(f"In TAHUN col but not dispos date: {len(by_th - by_dp)}")
print(f"In dispos date but not TAHUN col: {len(by_dp - by_th)}")

if by_dp - by_th:
    print("Sample in dispos date 2024 but TAHUN != 2024:")
    for row_num in list(by_dp - by_th)[:5]:
        r = rows[row_num - 1]
        print(f"  Row {row_num}: NO PA={r[1]}, TGL DISPOS={r[dispos_idx]}, TAHUN={r[th_idx]}")

if by_th - by_dp:
    print("Sample in TAHUN 2024 but dispos date != 2024:")
    for row_num in list(by_th - by_dp)[:5]:
        r = rows[row_num - 1]
        print(f"  Row {row_num}: NO PA={r[1]}, TGL DISPOS={r[dispos_idx]}, TAHUN={r[th_idx]}")
