import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

records = d['sitac_records']

print("Checking non-DKI records:")
for idx, r in enumerate(records):
    t = r['terminating'].upper()
    lat = r['latitude']
    lng = r['longitude']
    
    keywords = ['BATANG', 'KANDEMAN', 'PLTU', 'KUDUS', 'SEMARANG', 'BANDUNG', 'SUKABUMI', 'CIREBON', 'PURWAKARTA', 'SUBANG', 'CILEGON', 'SERANG', 'LEBAK', 'PANDEGLANG', 'LABUAN', 'ANYER', 'MERAK']
    found = [k for k in keywords if k in t]
    if found:
        print(f"[{idx+1}] Matches {found} -> ({lat}, {lng})")
        print(f"      Term: {r['terminating']}")
        print(f"      Pel:  {r.get('pelanggan')}")
        print("-" * 50)
