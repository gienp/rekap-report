import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

records = d['sitac_records']

suspicious = []
for idx, r in enumerate(records):
    t = r['terminating'].upper()
    lat = r['latitude']
    lng = r['longitude']
    pa = r.get('no_pa') or f"ROW_{idx+1}"
    c_type = r.get('coord_type')
    
    # Is coordinates in central DKI? (-6.25 to -6.15, 106.78 to 106.88)
    in_dki_center = (-6.25 <= lat <= -6.14) and (106.78 <= lng <= 106.88)
    
    # But text explicitly has outside DKI cities
    cities = ['TANGERANG', 'TANGSEL', 'CILEDUG', 'SERPONG', 'BEKASI', 'CIKARANG', 'TAMBUN', 'BOGOR', 'CIBINONG', 'DEPOK', 'CIMANGGIS', 'SERANG', 'CILEGON']
    found_cities = [c for c in cities if c in t]
    
    # Filter out prefixes or false positives
    if in_dki_center and found_cities:
        suspicious.append((idx+1, pa, found_cities, lat, lng, c_type, t))

print(f"Total suspicious central placements: {len(suspicious)}")
for s in suspicious:
    print(f"[{s[0]}] {s[1]} | Found: {s[2]} | Coords: ({s[3]}, {s[4]}) | Type: {s[5]}")
    print(f"     Term: {s[6]}")
    print("-" * 60)
