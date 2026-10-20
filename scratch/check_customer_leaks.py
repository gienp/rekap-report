import json
import re
import sys
import os

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

records = d.get('sitac_records', [])

print(f"Total SITAC records: {len(records)}\n")

# Check which records matched customer HQ or general terms
for idx, r in enumerate(records):
    term = r.get('terminating') or ''
    pel = r.get('pelanggan') or ''
    lat = r.get('latitude')
    lng = r.get('longitude')
    pa = r.get('no_pa') or ''

    # Let's inspect where lat/lng came from
    # Are there any APJII records?
    if 'APJII' in pel.upper() or 'APJII' in term.upper():
        print(f"Row {idx+1} [APJII]: Pel={pel} | Coords=({lat}, {lng}) | Term={term}")
    if 'INDOMOBIL' in pel.upper() or 'INDOMOBIL' in term.upper():
        print(f"Row {idx+1} [INDOMOBIL]: Pel={pel} | Coords=({lat}, {lng}) | Term={term}")
    if 'BNI' in pel.upper() or 'BNI' in term.upper():
        if 'BOGOR' in term.upper() or 'BEKASI' in term.upper() or 'TANGERANG' in term.upper() or 'DEPOK' in term.upper():
            print(f"Row {idx+1} [BNI outer]: Pel={pel} | Coords=({lat}, {lng}) | Term={term}")
