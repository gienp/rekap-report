import json
import re
import sys
import os
sys.path.insert(0, os.path.abspath('.'))
from scratch.build_comprehensive_geocoder import GEO_RULES, geocode_record

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

records = d.get('sitac_records', [])

matches = []
for idx, r in enumerate(records):
    term = r.get('terminating') or ''
    pel = r.get('pelanggan') or ''
    up = r.get('update_pekerjaan') or ''
    pa = r.get('no_pa') or ''
    lat, lng, rule = geocode_record(term, pel, up, pa)
    matches.append((idx+1, pa, pel, term, lat, lng, rule))

# Find records with questionable matches
for idx, pa, pel, term, lat, lng, rule in matches:
    t_upper = term.upper()
    # Check Kudus
    if 'KUDUS' in t_upper:
        print(f"[{idx}] KUDUS: {rule} -> ({lat}, {lng}) | {term}")
    # Check Cilegon
    if 'CILEGON' in t_upper:
        print(f"[{idx}] CILEGON: {rule} -> ({lat}, {lng}) | {term}")
    # Check Semarang
    if 'SEMARANG' in t_upper:
        print(f"[{idx}] SEMARANG: {rule} -> ({lat}, {lng}) | {term}")
    # Check Batang
    if 'BATANG' in t_upper:
        print(f"[{idx}] BATANG: {rule} -> ({lat}, {lng}) | {term}")
    # Check Bandung
    if 'BANDUNG' in t_upper:
        print(f"[{idx}] BANDUNG: {rule} -> ({lat}, {lng}) | {term}")
    # Check Purwakarta
    if 'PURWAKARTA' in t_upper:
        print(f"[{idx}] PURWAKARTA: {rule} -> ({lat}, {lng}) | {term}")
    # Check Karawang
    if 'KARAWANG' in t_upper:
        print(f"[{idx}] KARAWANG: {rule} -> ({lat}, {lng}) | {term}")
    # Check Serang
    if 'SERANG' in t_upper:
        print(f"[{idx}] SERANG: {rule} -> ({lat}, {lng}) | {term}")
    # Check Sukabumi
    if 'SUKABUMI' in t_upper:
        print(f"[{idx}] SUKABUMI: {rule} -> ({lat}, {lng}) | {term}")
    # Check Cirebon
    if 'CIREBON' in t_upper:
        print(f"[{idx}] CIREBON: {rule} -> ({lat}, {lng}) | {term}")
