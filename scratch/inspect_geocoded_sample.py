import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

records = d.get('sitac_records', [])
print(f"Total SITAC records: {len(records)}")

for idx in [0, 5, 10, 20, 50, 80, 100, 150, 200, 250, 300, 350, 400, 440]:
    if idx < len(records):
        r = records[idx]
        print(f"[{idx+1}] No PA: {r.get('no_pa')} | Pelanggan: {r.get('pelanggan')}")
        print(f"     Terminating: {r.get('terminating')}")
        print(f"     Coords: ({r.get('latitude')}, {r.get('longitude')})")
        print("-" * 60)
