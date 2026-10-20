import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

active = [r for r in data['collo_records'] if r.get('status') == 'ACTIVE']
active.sort(key=lambda r: (r.get('margin_rupiah') or 0), reverse=True)

print("Current Top 15 (Page 1) in Table:")
for i, r in enumerate(active[:15]):
    peng = r.get('pengelola') or '-'
    pel = (r.get('pelanggan') or '-')[:25]
    so = r.get('no_so') or '-'
    margin = r.get('margin_rupiah') or 0
    print(f"Row {i+1:2d}: ID={r['id']:4d} | {peng:30s} | {pel:25s} | {so:20s} | Margin={margin:,}")
