import sqlite3
import re

conn = sqlite3.connect('telecom_portal.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute('SELECT * FROM sitac_records')
records = cur.fetchall()

print(f"Total SITAC records: {len(records)}")

results = []

for r in records:
    text = (r['update_pekerjaan'] or '')
    if not text:
        continue
    
    awal = float(r['biaya_permintaan_awal'] or 0)
    final = float(r['biaya_final'] or 0)
    hemat = float(r['efisiensi_rupiah'] or 0)
    
    # Check for text patterns mentioning numbers in millions/jt/juta
    lower = text.lower()
    
    # 1. Check patterns like "menjadi X juta", "berubah menjadi X", "turun menjadi X", "nego menjadi X"
    m_menjadi = re.findall(r'(?:menjadi|berubah\s+menjadi|turun\s+menjadi|deal\s+di|sepakat\s+di|disepakati|di\s*tawar\s*menjadi)\s*(?:rp\.?\s*)?(\d+(?:[\.,]\d+)?)\s*(juta|jt)?', lower)
    
    # 2. Check patterns like "permintaan awal ... X juta" or "sebesar X juta"
    m_awal = re.findall(r'(?:permintaan\s+awal|biaya\s+koordinasi|biaya\s+perijinan|biaya\s+awal|sebesar|awalnya|awal\s+nya)\s*(?:sebesar)?\s*(?:rp\.?\s*)?(\d+(?:[\.,]\d+)?)\s*(juta|jt)', lower)
    
    if m_menjadi or m_awal:
        results.append({
            'id': r['id'],
            'no_pa': r['no_pa'],
            'terminating': r['terminating'],
            'db_awal': awal,
            'db_final': final,
            'db_hemat': hemat,
            'db_persen': r['efisiensi_persen'],
            'm_menjadi': m_menjadi,
            'm_awal': m_awal,
            'text': text
        })

print(f"Found {len(results)} records mentioning numbers in negotiations.")

for item in results:
    # Flag if db_final == 0 and m_menjadi is found, or if values look mismatched
    print("="*80)
    print(f"ID: {item['id']} | PA: {item['no_pa']} | Term: {item['terminating']}")
    print(f"DB -> Awal: {item['db_awal']:,.0f} | Final: {item['db_final']:,.0f} | Hemat: {item['db_hemat']:,.0f} | %: {item['db_persen']}")
    print(f"Detected Menjadi: {item['m_menjadi']}")
    print(f"Detected Awal: {item['m_awal']}")
    print(f"Excerpt: {item['text'][:400]}...")
