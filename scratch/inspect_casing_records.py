import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

casing_records = []
for r in data['collo_records']:
    js = r.get('jenis_sewa') or ''
    if js in ['COLOCATION', 'Cross connect', 'cross Connect']:
        casing_records.append((r['id'], r.get('pengelola'), r.get('pelanggan'), js))

print(f"Total records with abnormal jenis_sewa casing: {len(casing_records)}")
for cid, peng, pel, js in casing_records:
    print(f"  ID {cid}: [{js}] -> {peng} | {pel}")
