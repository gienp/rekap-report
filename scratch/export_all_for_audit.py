import json
import re

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

records = d['sitac_records']

with open('scratch/review_all_451_coords.txt', 'w', encoding='utf-8') as f:
    for idx, r in enumerate(records):
        f.write(f"[{idx+1}] PA: {r.get('no_pa')} | Pel: {r.get('pelanggan')}\n")
        f.write(f"     Terminating: {r.get('terminating')}\n")
        f.write(f"     Coords: ({r.get('latitude')}, {r.get('longitude')}) | Type: {r.get('coord_type')}\n\n")

print(f"Exported all {len(records)} records to scratch/review_all_451_coords.txt")
