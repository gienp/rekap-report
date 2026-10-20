import json
from collections import defaultdict

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

active = [r for r in data['collo_records'] if r.get('status') == 'ACTIVE']

by_no_so = defaultdict(list)
no_so_empty = []
for r in active:
    so = (r.get('no_so') or '').strip()
    if so:
        by_no_so[so.lower()].append(r)
    else:
        no_so_empty.append(r)

dupe_so = {k: v for k, v in by_no_so.items() if len(v) > 1}

print("=== SAMPLE DUPLICATE NO_SO GROUPS ===")
for i, (so, recs) in enumerate(list(dupe_so.items())[:10]):
    print(f"\n[{i+1}] SO: {so} (count: {len(recs)})")
    for r in recs:
        print(f"  ID {r['id']}: peng={r.get('pengelola')} | pel={r.get('pelanggan')} | term={r.get('terminating')[:30]} | start={r.get('start_date')} | end={r.get('end_date')} | rev={r.get('rev_sewa_tahun')} | biaya={r.get('biaya_sewa_tahun')} | po={r.get('po_baru')} | spp={r.get('spp')}")

by_cust_term = defaultdict(list)
for r in no_so_empty:
    peng = (r.get('pengelola') or '').strip().lower()
    pel = (r.get('pelanggan') or '').strip().lower()
    term = (r.get('terminating') or '').strip().lower()
    if term:
        by_cust_term[(peng, pel, term)].append(r)

dupe_cust_term = {k: v for k, v in by_cust_term.items() if len(v) > 1}
print("\n=== SAMPLE DUPLICATE NO-SO (PENGELOLA + PELANGGAN + TERM) GROUPS ===")
for i, (k, recs) in enumerate(list(dupe_cust_term.items())[:10]):
    print(f"\n[{i+1}] Key: {k[0]} | {k[1]} | {k[2][:30]} (count: {len(recs)})")
    for r in recs:
        print(f"  ID {r['id']}: sid={r.get('sid')} | start={r.get('start_date')} | end={r.get('end_date')} | rev={r.get('rev_sewa_tahun')} | biaya={r.get('biaya_sewa_tahun')} | po={r.get('po_baru')} | spp={r.get('spp')}")
