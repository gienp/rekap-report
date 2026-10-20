import sqlite3
import re

conn = sqlite3.connect('telecom_portal.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute('SELECT * FROM sitac_records WHERE no_pa LIKE "%A821103000308-2%" OR terminating LIKE "%A821103000308-2%"')
rows = cur.fetchall()

for row in rows:
    print('FOUND RECORD:')
    for k in row.keys():
        print(f'  {k}: {row[k]}')

# Check other records
print('\n--- ALL SITAC RECORDS WITH NEGOTIATION TEXT OR COST DISCREPANCY ---')
cur.execute('SELECT * FROM sitac_records')
all_records = cur.fetchall()
print(f'Total SITAC records: {len(all_records)}')

discrepant = []
for r in all_records:
    txt = (r['update_pekerjaan'] or '').lower()
    awal = r['biaya_permintaan_awal'] or 0
    final = r['biaya_final'] or 0
    
    # Check if text mentions changes in price / negotiation numbers
    matches = re.findall(r'(?:menjadi|berubah\s+menjadi|disepakati|deal\s+di|sepakat\s+di)\s+(?:rp\.?\s*)?(\d+[\d\.,]*)\s*(juta|jt|rb|ribu|000)?', txt)
    if matches:
        discrepant.append((r, matches))

print(f'\nFound {len(discrepant)} records with negotiation keywords + numbers:')
for r, m in discrepant:
    print(f"\nID: {r['id']} | PA: {r['no_pa']}")
    print(f"  Current DB -> Awal: {r['biaya_permintaan_awal']} | Final: {r['biaya_final']} | Hemat: {r['efisiensi_rupiah']} | %: {r['efisiensi_persen']}")
    print(f"  Regex matches: {m}")
    print(f"  Update text: {r['update_pekerjaan']}")
