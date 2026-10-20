import json
import re

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

sitac = d.get('sitac_records', [])

def extract_explicit_coords(text):
    m = re.search(r'(-?[0-8]\.\d{4,8})[,\s/]+(10[5-8]\.\d{4,8})', text)
    if m:
        try:
            return float(m.group(1)), float(m.group(2))
        except:
            pass
    return None

explicit = 0
for s in sitac:
    term = (s.get('terminating') or '') + ' ' + (s.get('update_pekerjaan') or '')
    c = extract_explicit_coords(term)
    if c:
        explicit += 1

print(f"Explicit tikor in text: {explicit}")
