import json
from collections import defaultdict

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

active = [r for r in data['collo_records'] if r.get('status') == 'ACTIVE']

def norm(s):
    return (s or '').strip().lower()

by_peng_so = defaultdict(list)
for r in active:
    so = norm(r.get('no_so'))
    peng = norm(r.get('pengelola'))
    if so and len(so) > 3:
        by_peng_so[(peng, so)].append(r)

for (peng, so), recs in by_peng_so.items():
    if len(recs) > 1:
        terms = set(norm(r.get('terminating')) for r in recs)
        if len(terms) > 1:
            print(f"\nSO: {so} under {peng} has {len(terms)} different term texts:")
            for r in recs:
                t = r.get('terminating') or ''
                p = r.get('pelanggan') or ''
                print(f"  ID {r['id']}: term='{t[:45]}' | pel='{p[:35]}'")
