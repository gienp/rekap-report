import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for r in data['collo_records']:
    if not r.get('jenis_sewa'):
        print(f"ID {r['id']}: pengelola='{r.get('pengelola')}' | pelanggan='{r.get('pelanggan')}' | metode='{r.get('metode_kerjasama')}' | status='{r.get('status')}'")
