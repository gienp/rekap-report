import json
import re
from collections import defaultdict

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

active = [r for r in data['collo_records'] if r.get('status') == 'ACTIVE']

def get_base_codes(text):
    if not text:
        return []
    # Match patterns like A821204000046, PA/ACT/2301/0482, 111204000080, etc.
    codes = re.findall(r'[A-Za-z0-9/]{7,}', text)
    # also strip any trailing dashes/subnumbers
    clean_codes = []
    for c in codes:
        clean = c.strip('/- ')
        if len(clean) >= 7 and not clean.isdigit() or len(clean) >= 10:
            clean_codes.append(clean.upper())
    return clean_codes

code_to_recs = defaultdict(list)
for r in active:
    so = r.get('no_so') or ''
    sid = r.get('sid') or ''
    codes = set(get_base_codes(so) + get_base_codes(sid))
    for c in codes:
        code_to_recs[c].append(r)

dupe_codes = {k: v for k, v in code_to_recs.items() if len(v) > 1}
print(f"Total duplicate codes: {len(dupe_codes)}")

for c, recs in list(dupe_codes.items())[:20]:
    pengs = set(r.get('pengelola') for r in recs)
    if len(pengs) == 1:
        print(f"\nCode: {c} under Pengelola '{list(pengs)[0]}' ({len(recs)} recs):")
        for r in recs:
            print(f"  ID {r['id']}: Pel={r.get('pelanggan')[:30]} | SO={r.get('no_so')} | Term={r.get('terminating')[:35]} | Dates={r.get('start_date')} to {r.get('end_date')} | Rev={r.get('rev_sewa_tahun'):,}")
