import json
from collections import defaultdict

def norm(s):
    return (s or '').strip().lower()

def norm_loc(s):
    s = norm(s)
    return ''.join(c for c in s if c.isalnum())[:35]

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

collo_list = data['collo_records']
collo_map = {r['id']: r for r in collo_list}

# All superseded records
superseded_ids = set(r['id'] for r in collo_list if r.get('alert_category') == 'SUPERSEDED')

# All master records that absorbed superseded records
master_ids = set()
for r in collo_list:
    ket = r.get('keterangan') or ''
    if ket.startswith('[Tergabung ke ID '):
        mid = int(ket.split('[Tergabung ke ID ')[1].split(']')[0])
        master_ids.add(mid)

all_mod_ids = superseded_ids.union(master_ids)
print(f"Total modified records: {len(all_mod_ids)} (Masters: {len(master_ids)}, Superseded: {len(superseded_ids)})")

modified_records = [collo_map[cid] for cid in all_mod_ids if cid in collo_map]

with open('scratch/modified_collo.json', 'w', encoding='utf-8') as f:
    json.dump(modified_records, f, ensure_ascii=False, indent=2)

print("Saved all 312 modified records to scratch/modified_collo.json")
