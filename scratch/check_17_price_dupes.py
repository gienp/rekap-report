import json
from collections import defaultdict

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

collo_list = data['collo_records']
active = [r for r in collo_list if r.get('status') == 'ACTIVE']

def norm(s):
    return (s or '').strip().lower()

groups = defaultdict(list)
for r in active:
    peng = norm(r.get('pengelola'))
    pel = norm(r.get('pelanggan'))
    rev = r.get('rev_sewa_tahun') or 0
    biaya = r.get('biaya_sewa_tahun') or 0
    key = (peng, pel, rev, biaya)
    groups[key].append(r)

dupes = {k: v for k, v in groups.items() if len(v) > 1}

print(f"Total price duplicate groups: {len(dupes)}")
for i, (k, recs) in enumerate(dupes.items()):
    print(f"\nGroup {i+1}: {k[0]} | {k[1][:30]} | Rev: {k[2]:,} | Biaya: {k[3]:,}")
    for r in recs:
        print(f"  ID {r['id']}: dates={r.get('start_date')} to {r.get('end_date')} | PO={r.get('po_baru')} | SPP={r.get('spp')} | term={r.get('terminating')[:40]}")
