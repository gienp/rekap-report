import json
from collections import defaultdict

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

collo = data['collo_records']
active = [r for r in collo if r.get('status') == 'ACTIVE']

print(f"Total collo records: {len(collo)}")
print(f"Active collo records: {len(active)}")

# Let's define matching rules for true duplicates:
# Rule 1: Same no_so (non-empty) AND same pengelola
# Rule 2: Same sid (non-empty) AND same pengelola
# Rule 3: Empty no_so & sid, but same pengelola AND same pelanggan AND same terminating AND same rev_sewa_tahun

dupe_groups_so = defaultdict(list)
dupe_groups_sid = defaultdict(list)
dupe_groups_exact = defaultdict(list)

handled_ids = set()

# Pass 1: by no_so
for r in active:
    so = (r.get('no_so') or '').strip().lower()
    peng = (r.get('pengelola') or '').strip().lower()
    if so and len(so) > 3:
        dupe_groups_so[(peng, so)].append(r)

real_so_dupes = {k: v for k, v in dupe_groups_so.items() if len(v) > 1}
for v in real_so_dupes.values():
    for r in v:
        handled_ids.add(r['id'])

# Pass 2: by sid (if not already handled)
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

# Pass 3: by (pengelola, pelanggan, terminating, rev_sewa_tahun) where terminating is non-empty
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
for v in real_exact_dupes.values():
    for r in v:
        handled_ids.add(r['id'])

print(f"\nReal duplicate groups by (pengelola, no_so): {len(real_so_dupes)}")
so_excess = sum(len(v) - 1 for v in real_so_dupes.values())
print(f"Excess records by no_so: {so_excess}")

print(f"\nReal duplicate groups by (pengelola, sid): {len(real_sid_dupes)}")
sid_excess = sum(len(v) - 1 for v in real_sid_dupes.values())
print(f"Excess records by sid: {sid_excess}")

print(f"\nReal duplicate groups by (pengelola, pelanggan, term, rev): {len(real_exact_dupes)}")
exact_excess = sum(len(v) - 1 for v in real_exact_dupes.values())
print(f"Excess records by exact match: {exact_excess}")

total_excess = so_excess + sid_excess + exact_excess
print(f"\nTotal excess duplicate active records: {total_excess}")
