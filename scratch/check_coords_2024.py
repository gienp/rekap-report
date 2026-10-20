import openpyxl
import re

wb = openpyxl.load_workbook('20241231_ Export Perizinan.xlsx', data_only=True)
sheet = wb['RAW data']
rows = list(sheet.iter_rows(values_only=True))

with_coords = 0
without_coords = 0
valid_coords = 0

for r in rows[1:]:
    if r[19] == 2024:
        coord_raw = str(r[7] or '').strip()
        if coord_raw and coord_raw != '-' and coord_raw != 'None':
            with_coords += 1
            # Check pattern lat, lng
            m = re.search(r'([-+]?\d+\.\d+)[,\s]+([-+]?\d+\.\d+)', coord_raw)
            if m:
                lat, lng = float(m.group(1)), float(m.group(2))
                # Validate indonesia latitude/longitude
                if -11 <= lat <= 6 and 95 <= lng <= 141:
                    valid_coords += 1
        else:
            without_coords += 1

print(f"2024 Rows with raw coords: {with_coords}")
print(f"2024 Rows with valid parsed coords: {valid_coords}")
print(f"2024 Rows without coords: {without_coords}")
