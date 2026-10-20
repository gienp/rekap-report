import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

sitac = d.get('sitac_records', [])
print(f'Total sitac records: {len(sitac)}')
with_coords = [s for s in sitac if s.get('latitude') and s.get('longitude')]
print(f'Records with coords: {len(with_coords)}')

coords_set = set((round(s['latitude'], 4), round(s['longitude'], 4)) for s in with_coords)
print(f'Unique coordinates: {len(coords_set)}')

for i, s in enumerate(with_coords[:30]):
    pel = str(s.get('pelanggan', ''))[:30]
    term = str(s.get('terminating', ''))[:45]
    lat = s.get('latitude')
    lng = s.get('longitude')
    print(f"[{i+1}] {pel} | {term} -> ({lat}, {lng})")
