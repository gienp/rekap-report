import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

collo = d.get('collo_records', [])
active = [c for c in collo if c.get('status') == 'ACTIVE']

groups = {}
for c in active:
    p = (c.get('pengelola') or '').strip().lower()
    pel = (c.get('pelanggan') or '').strip().lower()
    so = (c.get('no_so') or c.get('sid') or '').strip().lower()
    term = (c.get('terminating') or '').strip().lower()
    key = f"{p} || {pel} || {so} || {term}"
    groups.setdefault(key, []).append(c)

multi = {k: v for k, v in groups.items() if len(v) > 1}
print(f"Total duplicate ACTIVE links in collo_records: {len(multi)}")

for idx, (k, items) in enumerate(multi.items(), 1):
    print(f"\n=== DUPLICATE GROUP {idx} ({len(items)} records) ===")
    print("Key:", k[:120])
    for c in items:
        cid = c.get('id')
        start = c.get('start_date')
        end = c.get('end_date')
        po = c.get('po_baru')
        spp = c.get('spp')
        rev = c.get('rev_sewa_tahun')
        biaya = c.get('biaya_sewa_tahun')
        print(f"  ID: {cid}, Start: {start}, End: {end}, PO: {po}, SPP: {spp}, Rev: {rev}, Biaya: {biaya}")
