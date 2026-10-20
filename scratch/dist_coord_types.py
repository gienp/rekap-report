import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

records = d['sitac_records']

coord_types = {}
for r in records:
    ct = r.get('coord_type') or 'UNKNOWN'
    coord_types[ct] = coord_types.get(ct, 0) + 1

print("Distribution of coord_types across all 451 records:")
for ct, cnt in sorted(coord_types.items(), key=lambda x: -x[1]):
    print(f"  {ct}: {cnt}")
