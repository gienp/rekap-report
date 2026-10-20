import re
import json

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

selects = re.findall(r'<select[^>]+id=["\']([^"\']+)["\'][^>]*>', text)
print("All select IDs in index.html:")
for s in selects:
    print(" ", s)

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Inspect sitac_records fields
if 'sitac_records' in data and data['sitac_records']:
    print("\nSITAC fields:")
    s0 = data['sitac_records'][0]
    for k in s0.keys():
        vals = set(r.get(k) for r in data['sitac_records'] if r.get(k) is not None)
        if len(vals) < 20:
            print(f"  {k}: {sorted(list(vals), key=str)[:10]}")
