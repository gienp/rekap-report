import json
import re

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

records = d.get('sitac_records', [])

def analyze_address(term, idx, pa, pel):
    t_clean = term.upper()
    
    # Strip prefix codes like (BEKASI)(TUMJ)... or (LEBAK)(T0QM)... or (PURWAKARTA)(TXDK)...
    # Often formatted as: (DISTRICT/BRANCH)(CODE)(STORE_NAME) ACTUAL_ADDRESS
    prefix_match = re.match(r'^\s*(\([^\)]+\)\s*)+', t_clean)
    prefix = prefix_match.group(0) if prefix_match else ""
    body = t_clean[len(prefix):].strip()
    
    return {
        'idx': idx,
        'pa': pa,
        'pel': pel,
        'prefix': prefix,
        'body': body,
        'raw': term
    }

parsed = [analyze_address(r['terminating'], idx+1, r['no_pa'], r['pelanggan']) for idx, r in enumerate(records)]

# Check rows where prefix has a city name but body has a different city name
mismatches = []
for p in parsed:
    pref = p['prefix']
    body = p['body']
    cities = ['BEKASI', 'BOGOR', 'DEPOK', 'TANGERANG', 'SERANG', 'LEBAK', 'PURWAKARTA', 'CILEGON', 'JAKARTA', 'KARAWANG']
    pref_cities = [c for c in cities if c in pref]
    body_cities = [c for c in cities if c in body]
    if pref_cities and body_cities and pref_cities[0] != body_cities[0]:
        mismatches.append((p['idx'], p['pa'], pref_cities, body_cities, p['raw']))

print(f"Total prefix vs body city conflicts: {len(mismatches)}")
for m in mismatches:
    print(f"Row {m[0]} [{m[1]}]: Prefix={m[2]} vs Body={m[3]}")
    print(f"   Raw: {m[4]}")
