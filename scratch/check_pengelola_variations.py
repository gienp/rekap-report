import json
from collections import defaultdict

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Check unique pengelola
pengs = [r.get('pengelola') for r in data['collo_records'] if r.get('pengelola')]
peng_lower_map = defaultdict(set)
for p in pengs:
    peng_lower_map[p.strip().lower()].add(p.strip())

casing_pengs = {k: v for k, v in peng_lower_map.items() if len(v) > 1}
print(f"Total pengelola with casing/format variations: {len(casing_pengs)}")
for k, v in sorted(casing_pengs.items()):
    print(f"  {k} -> {v}")
