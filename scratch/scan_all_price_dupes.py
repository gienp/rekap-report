import json
from collections import defaultdict

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

collo_list = data['collo_records']
active = [r for r in collo_list if r.get('status') == 'ACTIVE']

def norm(s):
    return (s or '').strip().lower()

# Check groups where pengelola & pelanggan & rev > 0 are identical
by_peng_pel_rev = defaultdict(list)
for r in active:
    peng = norm(r.get('pengelola'))
    pel = norm(r.get('pelanggan'))
    rev = r.get('rev_sewa_tahun') or 0
    if rev > 0:
        by_peng_pel_rev[(peng, pel, rev)].append(r)

dupe_rev = {k: v for k, v in by_peng_pel_rev.items() if len(v) > 1}
print(f"Groups with same (pengelola, pelanggan, rev > 0): {len(dupe_rev)}")
for k, recs in list(dupe_rev.items()):
    print(f"\n{k[0]} | {k[1][:25]} | Rev: {k[2]:,} ({len(recs)} rows)")
    for r in recs:
        print(f"  ID {r['id']}: term='{r.get('terminating')[:35]}' | dates={r.get('start_date')} to {r.get('end_date')} | PO={r.get('po_baru')} | SPP={r.get('spp')}")

# Check groups where pengelola & pelanggan & biaya > 0 are identical (where rev == 0)
by_peng_pel_biaya = defaultdict(list)
for r in active:
    peng = norm(r.get('pengelola'))
    pel = norm(r.get('pelanggan'))
    rev = r.get('rev_sewa_tahun') or 0
    biaya = r.get('biaya_sewa_tahun') or 0
    if rev == 0 and biaya > 0:
        by_peng_pel_biaya[(peng, pel, biaya)].append(r)

dupe_biaya = {k: v for k, v in by_peng_pel_biaya.items() if len(v) > 1}
print(f"\nGroups with same (pengelola, pelanggan, rev=0, biaya > 0): {len(dupe_biaya)}")
for k, recs in list(dupe_biaya.items()):
    print(f"\n{k[0]} | {k[1][:25]} | Biaya: {k[2]:,} ({len(recs)} rows)")
    for r in recs:
        print(f"  ID {r['id']}: term='{r.get('terminating')[:35]}' | dates={r.get('start_date')} to {r.get('end_date')} | PO={r.get('po_baru')} | SPP={r.get('spp')}")
