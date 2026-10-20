import json
import re

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

active = [r for r in data['collo_records'] if r.get('status') == 'ACTIVE']

def simplify(s):
    if not s:
        return ""
    s = s.lower()
    s = re.sub(r'[^a-z0-9]', '', s)
    return s

# Group by (simplify(pengelola), simplify(pelanggan), simplify(terminating))
groups = {}
for r in active:
    peng = simplify(r.get('pengelola'))
    pel = simplify(r.get('pelanggan'))
    term = simplify(r.get('terminating'))
    
    # Try exact match on simplified
    key = (peng, pel, term[:30])
    if key not in groups:
        groups[key] = []
    groups[key].append(r)

dupe_groups = {k: v for k, v in groups.items() if len(v) > 1}
print(f"Total groups with identical simplified (pengelola, pelanggan, terminating[:30]): {len(dupe_groups)}")

for k, records in dupe_groups.items():
    print(f"\nGroup: {k[0]} | {k[1]} | {k[2]}")
    for r in records:
        print(f"  ID {r['id']}: Pel='{r.get('pelanggan')}' | SO='{r.get('no_so')}' | Dates={r.get('start_date')} to {r.get('end_date')} | Rev={r.get('rev_sewa_tahun'):,} | PO={r.get('po_baru')}")
