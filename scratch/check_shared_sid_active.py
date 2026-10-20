import json
import re
from collections import defaultdict

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

active = [r for r in data['collo_records'] if r.get('status') == 'ACTIVE']

sid_to_records = defaultdict(list)
for r in active:
    sid_str = r.get('sid') or ''
    # extract tokens like 111303013881, 01000362396, etc.
    tokens = re.findall(r'[0-9]{8,}', sid_str)
    for t in tokens:
        sid_to_records[t].append(r)

print(f"Total SID tokens shared by multiple active records: {sum(1 for v in sid_to_records.values() if len(v) > 1)}")
for token, recs in sid_to_records.items():
    if len(recs) > 1:
        unique_ids = list({r['id'] for r in recs})
        if len(unique_ids) > 1:
            print(f"\nSID Token: {token} (Count: {len(unique_ids)})")
            for r in recs:
                print(f"  ID {r['id']}: Peng='{r.get('pengelola')}' | Pel='{r.get('pelanggan')}' | SO='{r.get('no_so')}' | Dates={r.get('start_date')} to {r.get('end_date')} | Rev={r.get('rev_sewa_tahun'):,} | PO={r.get('po_baru')}")
