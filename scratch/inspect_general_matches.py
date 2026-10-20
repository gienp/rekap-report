import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

records = d['sitac_records']

for cat in ['GEO_BEKASI', 'GEO_TANGERANG', 'GEO_BOGOR', 'GEO_DEPOK']:
    print(f"\n==================== {cat} ====================")
    matched = [r for r in records if r.get('coord_type') == cat]
    for m in matched:
        print(f"[{m['id']}] PA: {m['no_pa']} | Terminating: {m['terminating']}")
