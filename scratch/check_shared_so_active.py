import json
import re
from collections import defaultdict

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

active = [r for r in data['collo_records'] if r.get('status') == 'ACTIVE']

so_to_records = defaultdict(list)
for r in active:
    so_str = r.get('no_so') or ''
    # extract tokens like A821204000046, PA/ACT/2303/1608, etc.
    tokens = re.findall(r'[A-Za-z0-9]{8,}', so_str)
    for t in tokens:
        so_to_records[t.upper()].append(r)

print(f"Total SO tokens shared by multiple active records: {sum(1 for v in so_to_records.values() if len(v) > 1)}")
for token, recs in so_to_records.items():
    if len(recs) > 1:
        # Check if they have the same customer / pengelola
        pels = [r.get('pelanggan') for r in recs]
        pengs = [r.get('pengelola') for r in recs]
        print(f"\nSO Token: {token} (Count: {len(recs)})")
        for r in recs:
            print(f"  ID {r['id']}: Peng='{r.get('pengelola')}' | Pel='{r.get('pelanggan')}' | SO='{r.get('no_so')}' | Dates={r.get('start_date')} to {r.get('end_date')} | Rev={r.get('rev_sewa_tahun'):,} | PO={r.get('po_baru')}")
