import sqlite3, json, os, glob

# 1. DB
conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
for t in ('sitac_records', 'gangguan_records', 'collo_records'):
    c.execute(f"UPDATE {t} SET foto_bukti = NULL WHERE foto_bukti IS NOT NULL AND foto_bukti != ''")
    print(t, 'cleared', c.rowcount)
conn.commit()
conn.close()

# 2. JSON + JS
with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)
for k in ('sitac_records', 'gangguan_records', 'collo_records'):
    for r in d.get(k, []):
        if r.get('foto_bukti'):
            r['foto_bukti'] = None
with open('sitac_collo_data.json', 'w', encoding='utf-8') as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
with open('sitac_collo_data.js', 'w', encoding='utf-8') as f:
    f.write("// Telecom Infrastructure & Lease Operations Portal - Unified Master Data\nwindow.SITAC_COLLO_DATA = " + json.dumps(d, ensure_ascii=False) + ";\n")

# 3. uploads (test artifacts only)
for p in glob.glob('uploads/*'):
    os.remove(p)
    print('removed', p)
print('done')
