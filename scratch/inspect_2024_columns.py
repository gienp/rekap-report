import openpyxl

wb = openpyxl.load_workbook('20241231_ Export Perizinan.xlsx', data_only=True)
sheet = wb['RAW data']
rows = list(sheet.iter_rows(values_only=True))
header = rows[0]

print("=== COLUMNS IN RAW data ===")
for i, h in enumerate(header):
    print(f"[{i}] {repr(h)}")

print("\n=== SAMPLES OF 2024 DATA ===")
count = 0
for idx, r in enumerate(rows[1:], start=2):
    if r[19] == 2024:
        count += 1
        if count <= 5:
            print(f"\n--- Row {idx} (Sample {count}) ---")
            for i, val in enumerate(r):
                if val is not None:
                    print(f"  [{i}] {header[i]}: {repr(val)}")
print(f"\nTotal 2024 rows: {count}")
