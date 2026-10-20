import json
import sys, os
sys.path.insert(0, os.path.abspath('.'))
from scratch.build_perfect_geocoder import geocode_accurate

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    master_data = json.load(f)

records = master_data['sitac_records']
test_ids = [36, 68, 92, 129, 160, 191, 253, 308, 319, 378, 408, 411]

for tid in test_ids:
    r = records[tid-1]
    lat, lng, c_type, desc = geocode_accurate(r['terminating'], r['no_pa'], r['pelanggan'], r.get('update_pekerjaan', ''))
    term_snippet = r['terminating'][:75]
    print(f"Row {tid}: {c_type} -> ({lat:.4f}, {lng:.4f}) | {desc}")
    print(f"     Term: {term_snippet}")
    print("-" * 70)
