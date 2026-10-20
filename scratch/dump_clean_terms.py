import json
import re

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

records = d.get('sitac_records', [])

print(f"Total SITAC records: {len(records)}\n")

# Let's inspect all terminating values
all_terms = [(idx+1, r['no_pa'], r['pelanggan'], r['terminating']) for idx, r in enumerate(records)]

with open('scratch/all_terminatings_clean.txt', 'w', encoding='utf-8') as f:
    for idx, pa, pel, term in all_terms:
        f.write(f"[{idx}] {pa} | {pel} | {term}\n")

print("Saved scratch/all_terminatings_clean.txt")
