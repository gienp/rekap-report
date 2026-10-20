import json
import sqlite3
from collections import defaultdict

def norm(s):
    return (s or '').strip().lower()

def norm_loc(s):
    s = norm(s)
    return ''.join(c for c in s if c.isalnum())[:35]

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

collo_list = data['collo_records']
active = [r for r in collo_list if r.get('status') == 'ACTIVE']

groups = defaultdict(list)
handled_ids = set()

# Pass 1: SO + LOC
for r in active:
    so = norm(r.get('no_so'))
    loc = norm_loc(r.get('terminating'))
    peng = norm(r.get('pengelola'))
    pel = norm(r.get('pelanggan'))
    if so and len(so) > 3 and loc:
        groups[('SO+LOC', peng, pel, so, loc)].append(r)

# Pass 2: SID + LOC
for r in active:
    so = norm(r.get('no_so'))
    loc = norm_loc(r.get('terminating'))
    sid = norm(r.get('sid'))
    peng = norm(r.get('pengelola'))
    pel = norm(r.get('pelanggan'))
    if (not so or len(so) <= 3) and sid and len(sid) > 3 and loc:
        groups[('SID+LOC', peng, pel, sid, loc)].append(r)

# Pass 3: SO only (if loc empty)
for r in active:
    so = norm(r.get('no_so'))
    loc = norm_loc(r.get('terminating'))
    peng = norm(r.get('pengelola'))
    pel = norm(r.get('pelanggan'))
    if so and len(so) > 3 and not loc:
        groups[('SO_ONLY', peng, pel, so)].append(r)

# Pass 4: SID only (if loc empty)
for r in active:
    so = norm(r.get('no_so'))
    sid = norm(r.get('sid'))
    loc = norm_loc(r.get('terminating'))
    peng = norm(r.get('pengelola'))
    pel = norm(r.get('pelanggan'))
    if (not so or len(so) <= 3) and sid and len(sid) > 3 and not loc:
        groups[('SID_ONLY', peng, pel, sid)].append(r)

# Pass 5: LOC + REV (for identical physical link where so & sid empty)
for r in active:
    so = norm(r.get('no_so'))
    sid = norm(r.get('sid'))
    loc = norm_loc(r.get('terminating'))
    peng = norm(r.get('pengelola'))
    pel = norm(r.get('pelanggan'))
    rev = r.get('rev_sewa_tahun', 0)
    if (not so or len(so) <= 3) and (not sid or len(sid) <= 3) and loc and len(loc) > 15:
        groups[('LOC+REV', peng, pel, loc, rev)].append(r)

dupe_groups = {k: v for k, v in groups.items() if len(v) > 1}
print(f"Total duplicate groups to consolidate: {len(dupe_groups)}")

consolidated_masters = []
superseded_records = []

for k, recs in dupe_groups.items():
    # Sort recs: latest end_date first, then highest id
    sorted_recs = sorted(recs, key=lambda r: (r.get('end_date') or '', r.get('id') or 0), reverse=True)
    master = sorted_recs[0]
    superseded = sorted_recs[1:]
    
    # Check if ID 828/866 is here
    ids = [r['id'] for r in sorted_recs]
    if 828 in ids or 866 in ids:
        print(f"\n[TARGET GROUP] Found user group! IDs: {ids}")
        print(f"  Master will be: ID {master['id']} (end_date: {master.get('end_date')})")
        print(f"  Superseded: {[s['id'] for s in superseded]}")
    
    consolidated_masters.append((master, superseded))
    superseded_records.extend(superseded)

print(f"\nTotal master records to enhance: {len(consolidated_masters)}")
print(f"Total superseded records to mark NON ACTIVE: {len(superseded_records)}")
