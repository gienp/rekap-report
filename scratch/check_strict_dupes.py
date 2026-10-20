import json
from collections import defaultdict

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

active = [r for r in data['collo_records'] if r.get('status') == 'ACTIVE']

def norm(s):
    return (s or '').strip().lower()

def norm_loc(s):
    s = norm(s)
    # take first 30 chars of alphanumeric
    return ''.join(c for c in s if c.isalnum())[:30]

# Group by (pengelola, pelanggan, no_so, terminating_slug)
groups = defaultdict(list)
for r in active:
    peng = norm(r.get('pengelola'))
    pel = norm(r.get('pelanggan'))
    so = norm(r.get('no_so'))
    sid = norm(r.get('sid'))
    loc = norm_loc(r.get('terminating'))
    
    # Priority key:
    if so and len(so) > 3:
        key = ('SO', peng, pel, so, loc)
    elif sid and len(sid) > 3:
        key = ('SID', peng, pel, sid, loc)
    elif loc and len(loc) > 10:
        key = ('LOC', peng, pel, loc)
    else:
        continue
    groups[key].append(r)

dupe_groups = {k: v for k, v in groups.items() if len(v) > 1}
print(f"Total True Duplicate Groups: {len(dupe_groups)}")
total_rows = sum(len(v) for v in dupe_groups.values())
excess_rows = sum(len(v) - 1 for v in dupe_groups.values())
print(f"Total rows in dupe groups: {total_rows}")
print(f"Excess rows to consolidate: {excess_rows}")

print("\n--- SAMPLE GROUPS ---")
for i, (k, v) in enumerate(list(dupe_groups.items())[:15]):
    print(f"\nGroup {i+1} [Type: {k[0]}]: pengelola='{k[1]}', pel='{k[2][:25]}', ref='{k[3]}'")
    for r in v:
        print(f"  ID {r['id']}: dates={r.get('start_date')} to {r.get('end_date')} | rev={r.get('rev_sewa_tahun')} | biaya={r.get('biaya_sewa_tahun')} | PO={r.get('po_baru')} | SPP={r.get('spp')}")
