import sqlite3
import re

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

c.execute("SELECT id, no_pa, pelanggan, terminating, biaya_permintaan_awal, biaya_final, efisiensi_rupiah, update_pekerjaan FROM sitac_records WHERE biaya_final = 0 AND update_pekerjaan IS NOT NULL")
rows = c.fetchall()

print(f"Total records with biaya_final == 0: {len(rows)}")

matches = []
for r in rows:
    text = (r[7] or '').lower()
    # Check for payment or settled mentions
    has_transfer = 'transfer' in text or 'kwitansi' in text or 'dibayarkan' in text or 'pembayaran' in text
    has_nego = 'nego' in text or 'menjadi' in text or 'sepakat' in text
    has_amount = bool(re.search(r'\b(?:rp\.?|sebesar)\s*([0-9]+(?:[\.,][0-9]+)?)\s*(?:juta|jt|ribu|rb|000\.000)?', text))
    
    if (has_transfer or has_nego) and has_amount:
        matches.append(r)

print(f"\nFound {len(matches)} records with payment/nego keywords and amounts:")
for r in matches:
    print(f"\nID: {r[0]} | PA: {r[1]} | Pelanggan: {r[2]}")
    for line in (r[7] or '').split('\n'):
        if any(k in line.lower() for k in ['transfer', 'kwitansi', 'dibayarkan', 'nego', 'menjadi', 'sebesar', 'biaya']):
            print(f"  > {line.strip()[:140]}")
