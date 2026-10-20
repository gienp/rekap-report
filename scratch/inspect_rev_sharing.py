import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

found = []
for r in data['collo_records']:
    if r.get('rev_sharing') or r.get('rev_sharing_pct'):
        found.append((r['id'], r.get('pengelola'), r.get('rev_sharing'), r.get('rev_sharing_pct'), r.get('rev_sewa_tahun'), r.get('biaya_sewa_tahun')))

print(f"Total records with rev_sharing: {len(found)}")
for x in found[:25]:
    print(f"ID {x[0]} ({x[1]}): rev_sharing={repr(x[2])}, rev_sharing_pct={repr(x[3])}, rev={x[4]}, biaya={x[5]}")
