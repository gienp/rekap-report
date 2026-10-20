import json
from collections import defaultdict

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

collo = data['collo_records']
active = [r for r in collo if r.get('status') == 'ACTIVE']

dupe_groups_so = defaultdict(list)
dupe_groups_sid = defaultdict(list)
dupe_groups_exact = defaultdict(list)
handled_ids = set()

for r in active:
    so = (r.get('no_so') or '').strip().lower()
    peng = (r.get('pengelola') or '').strip().lower()
    if so and len(so) > 3:
        dupe_groups_so[(peng, so)].append(r)

real_so_dupes = {k: v for k, v in dupe_groups_so.items() if len(v) > 1}
for v in real_so_dupes.values():
    for r in v:
        handled_ids.add(r['id'])

for r in active:
    if r['id'] in handled_ids:
        continue
    sid = (r.get('sid') or '').strip().lower()
    peng = (r.get('pengelola') or '').strip().lower()
    if sid and len(sid) > 3:
        dupe_groups_sid[(peng, sid)].append(r)

real_sid_dupes = {k: v for k, v in dupe_groups_sid.items() if len(v) > 1}
for v in real_sid_dupes.values():
    for r in v:
        handled_ids.add(r['id'])

for r in active:
    if r['id'] in handled_ids:
        continue
    peng = (r.get('pengelola') or '').strip().lower()
    pel = (r.get('pelanggan') or '').strip().lower()
    term = (r.get('terminating') or '').strip().lower()
    rev = r.get('rev_sewa_tahun') or 0
    if term and len(term) > 5 and pel and len(pel) > 2:
        dupe_groups_exact[(peng, pel, term, rev)].append(r)

real_exact_dupes = {k: v for k, v in dupe_groups_exact.items() if len(v) > 1}

print("=== SAMPLE SO DUPES ===")
for k, recs in list(real_so_dupes.items())[:6]:
    print("KEY:", k)
    for r in recs:
        print(f"  ID {r['id']}: pel={r.get('pelanggan')} | dates={r.get('start_date')} to {r.get('end_date')} | po={r.get('po_baru')} | spp={r.get('spp')} | rev={r.get('rev_sewa_tahun')} | biaya={r.get('biaya_sewa_tahun')}")

print("\n=== SAMPLE SID DUPES ===")
for k, recs in list(real_sid_dupes.items())[:6]:
    print("KEY:", k)
    for r in recs:
        print(f"  ID {r['id']}: pel={r.get('pelanggan')} | dates={r.get('start_date')} to {r.get('end_date')} | po={r.get('po_baru')} | spp={r.get('spp')} | rev={r.get('rev_sewa_tahun')}")

print("\n=== SAMPLE EXACT DUPES ===")
for k, recs in list(real_exact_dupes.items())[:6]:
    print("KEY:", k[0], k[1], k[2][:30], k[3])
    for r in recs:
        print(f"  ID {r['id']}: pel={r.get('pelanggan')} | dates={r.get('start_date')} to {r.get('end_date')} | po={r.get('po_baru')} | spp={r.get('spp')} | rev={r.get('rev_sewa_tahun')}")
