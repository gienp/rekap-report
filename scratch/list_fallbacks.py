import json
from test_full_geocoder import geocode

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    sitac = json.load(f).get('sitac_records', [])

fallbacks = []
for s in sitac:
    lat, lng, m = geocode(s.get('terminating') or '', s.get('pelanggan') or '', s.get('update_pekerjaan') or '')
    if m == 'FALLBACK_JAKARTA':
        fallbacks.append((s.get('id'), s.get('pelanggan', ''), s.get('terminating', '')))

print(f"Total fallbacks: {len(fallbacks)}")
for fid, p, t in fallbacks:
    print(f"ID {fid}: {p[:30]} ---> {t}")
