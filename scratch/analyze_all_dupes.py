import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

collo = data.get('collo_records', [])
active = [c for c in collo if c.get('status') == 'ACTIVE']

groups = {}
for c in active:
    p = (c.get('pengelola') or '').strip().lower()
    pel = (c.get('pelanggan') or '').strip().lower()
    so = (c.get('no_so') or c.get('sid') or '').strip().lower()
    term = (c.get('terminating') or '').strip().lower()
    key = f"{p} || {pel} || {so} || {term}"
    groups.setdefault(key, []).append(c)

duplicate_groups = {k: v for k, v in groups.items() if len(v) > 1}
print(f"Total active circuits: {len(active)}")
print(f"Duplicate groups: {len(duplicate_groups)}")

# Inspect the duplicate groups
for idx, (k, items) in enumerate(list(duplicate_groups.items())[:20], 1):
    print(f"\nGroup {idx} ({len(items)} items): {k[:100]}")
    for item in items:
        print(f"  ID: {item.get('id')}, Dates: {item.get('start_date')} to {item.get('end_date')}, PO: {item.get('po_baru')}, Rev: {item.get('rev_sewa_tahun')}, Biaya: {item.get('biaya_sewa_tahun')}")
