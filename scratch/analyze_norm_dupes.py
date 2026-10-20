import json
from collections import defaultdict

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

active = [r for r in data['collo_records'] if r.get('status') == 'ACTIVE']

def norm(s):
    return (s or '').strip().lower()

def norm_loc(s):
    s = norm(s)
    # clean whitespaces and symbols
    return ''.join(c for c in s if c.isalnum())[:35]

groups = defaultdict(list)
for r in active:
    peng = norm(r.get('pengelola'))
    pel = norm(r.get('pelanggan'))
    so = norm(r.get('no_so'))
    sid = norm(r.get('sid'))
    loc = norm_loc(r.get('terminating'))
    
    # Matching key:
    if so and len(so) > 3 and loc:
        key = ('SO+LOC', peng, pel, so, loc)
    elif so and len(so) > 3 and not loc:
        key = ('SO_ONLY', peng, pel, so)
    elif sid and len(sid) > 3 and loc:
        key = ('SID+LOC', peng, pel, sid, loc)
    elif sid and len(sid) > 3 and not loc:
        key = ('SID_ONLY', peng, pel, sid)
    elif loc and len(loc) > 15:
        # Check if same peng, pel, loc, and rev
        key = ('LOC+REV', peng, pel, loc, r.get('rev_sewa_tahun', 0))
    else:
        continue
    groups[key].append(r)

dupes = {k: v for k, v in groups.items() if len(v) > 1}
print(f"Total duplicate groups: {len(dupes)}")
total_dupe_rows = sum(len(v) for v in dupes.values())
excess = sum(len(v) - 1 for v in dupes.values())
print(f"Total rows in dupe groups: {total_dupe_rows}")
print(f"Excess duplicate rows: {excess}")

by_type = defaultdict(int)
for k, v in dupes.items():
    by_type[k[0]] += len(v) - 1
for t, cnt in by_type.items():
    print(f"  Type {t}: {cnt} excess rows")
