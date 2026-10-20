import sqlite3
import re

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

c.execute("SELECT id, no_pa, pelanggan, terminating, biaya_permintaan_awal, biaya_final, efisiensi_rupiah, efisiensi_persen, update_pekerjaan FROM sitac_records WHERE id = 489 OR no_pa = 'A821103000308-2'")
row = c.fetchone()
print("ID 489 current state in SQLite:")
if row:
    print(f"ID: {row[0]}, PA: {row[1]}, Pelanggan: {row[2]}, Awal: {row[4]}, Final: {row[5]}, Efisiensi: {row[6]} ({row[7]}%)")
    print(f"Update pekerjaan preview:\n{str(row[8])}")
else:
    print("Not found")

print("\n--- Scanning other records where biaya_final == 0 but update_pekerjaan mentions negotiation/costs ---")
c.execute("SELECT id, no_pa, pelanggan, terminating, biaya_permintaan_awal, biaya_final, efisiensi_rupiah, efisiensi_persen, update_pekerjaan FROM sitac_records WHERE update_pekerjaan IS NOT NULL AND update_pekerjaan != ''")
rows = c.fetchall()

candidates = []
for r in rows:
    ket = r[8] or ''
    # Check if text mentions "menjadi X juta" or similar fee negotiation
    if re.search(r'menjadi\s*(?:sebesar)?\s*(?:rp\.?)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:juta|jt)?', ket, re.IGNORECASE):
        candidates.append(r)

print(f"Found {len(candidates)} records mentioning 'menjadi ...'")
for r in candidates:
    print(f"\nID: {r[0]} | PA: {r[1]} | Pelanggan: {r[2]} | Awal: {r[4]:,} | Final: {r[5]:,} | Efisiensi: {r[6]:,}")
    for line in (r[8] or '').split('\n'):
        if any(w in line.lower() for w in ['menjadi', '35 juta', '15 juta', 'negosiasi']):
            print(f"   -> {line.strip()[:150]}")
