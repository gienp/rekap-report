import json
from collections import defaultdict

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

collo = data.get('collo_records', [])
active_collo = [r for r in collo if r.get('status') == 'ACTIVE']

print(f'Total ACTIVE collo records: {len(active_collo)}')

groups = defaultdict(list)
for r in active_collo:
    peng = (r.get('pengelola') or '').strip().lower()
    pel = (r.get('pelanggan') or '').strip().lower()
    so = (r.get('no_so') or '').strip().lower()
    term = (r.get('terminating') or '').strip().lower()
    key = (peng, pel, so, term)
    groups[key].append(r)

dupe_groups = {k: v for k, v in groups.items() if len(v) > 1}
print(f'Duplicate groups count (key = peng, pel, no_so, term): {len(dupe_groups)}')
total_dupe_rows = sum(len(v) for v in dupe_groups.values())
print(f'Total rows in duplicate groups: {total_dupe_rows} (excess rows: {total_dupe_rows - len(dupe_groups)})')

for i, (k, v) in enumerate(list(dupe_groups.items())[:15]):
    print(f"\n--- Group {i+1}: pengelola='{k[0]}', no_so='{k[2]}' ({len(v)} rows) ---")
    for rec in v:
        print(f"  ID: {rec['id']} | Start: {rec.get('start_date')} | End: {rec.get('end_date')} | PO: {rec.get('po_baru')} | SPP: {rec.get('spp')} | Rev: {rec.get('rev_sewa_tahun')} | Biaya: {rec.get('biaya_sewa_tahun')}")
