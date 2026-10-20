import openpyxl

wb = openpyxl.load_workbook('20241231_ Export Perizinan.xlsx', data_only=True)
sheet = wb['RAW data']
rows = list(sheet.iter_rows(values_only=True))

for idx, r in enumerate(rows[1:], start=2):
    if r[19] == 2024 and (r[9] or r[10]):
        otc = r[9]
        sewa = r[10]
        update_txt = str(r[17] or '')[:120].replace('\n', ' ')
        print(f"Row {idx} | PA: {r[1]} | Pelanggan: {r[2]} | OTC: {otc} | Sewa: {sewa} | Update: {update_txt}")
