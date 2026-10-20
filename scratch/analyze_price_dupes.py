import json
from collections import defaultdict

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

collo_list = data['collo_records']
active = [r for r in collo_list if r.get('status') == 'ACTIVE']

def norm(s):
    return (s or '').strip().lower()

# Group by (pengelola, pelanggan, rev_sewa_tahun, biaya_sewa_tahun)
groups = defaultdict(list)
for r in active:
    peng = norm(r.get('pengelola'))
    pel = norm(r.get('pelanggan'))
    rev = r.get('rev_sewa_tahun') or 0
    biaya = r.get('biaya_sewa_tahun') or 0
    
    key = (peng, pel, rev, biaya)
    groups[key].append(r)

dupes = {k: v for k, v in groups.items() if len(v) > 1}
print(f"Total groups with same (pengelola, pelanggan, rev, biaya): {len(dupes)}")
total_rows = sum(len(v) for v in dupes.values())
excess = sum(len(v) - 1 for v in dupes.values())
print(f"Total rows: {total_rows}, Excess rows: {excess}")

for i, (k, v) in enumerate(list(dupes.items())[:20]):
    print(f"\n--- Group {i+1}: Peng='{k[0]}', Pel='{k[1][:25]}', Rev={k[2]:,}, Biaya={k[3]:,} ({len(v)} rows) ---")
    for r in v:
        print(f"  ID {r['id']}: term='{r.get('terminating')[:40]}' | dates={r.get('start_date')} to {r.get('end_date')} | PO={r.get('po_baru')} | SPP={r.get('spp')}")
