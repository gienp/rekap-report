import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

sitac = d.get('sitac_records', [])

for idx, s in enumerate(sitac):
    p = str(s.get('pelanggan', ''))
    t = str(s.get('terminating', ''))
    print(f"[{idx+1}] ID:{s.get('id')} | P:{p[:25]} | T:{t}")
