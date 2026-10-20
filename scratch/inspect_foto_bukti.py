import sqlite3, os, json
conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
for t in ('sitac_records', 'gangguan_records', 'collo_records'):
    try:
        c.execute(f"SELECT COUNT(*), COUNT(CASE WHEN foto_bukti IS NOT NULL AND foto_bukti != '' THEN 1 END) FROM {t}")
        print(t, c.fetchone())
        c.execute(f"SELECT id, no_pa, foto_bukti FROM {t} WHERE foto_bukti IS NOT NULL AND foto_bukti != '' LIMIT 20" if t=='sitac_records' else f"SELECT id, foto_bukti FROM {t} WHERE foto_bukti IS NOT NULL AND foto_bukti != '' LIMIT 20")
        for r in c.fetchall(): print('  ', r)
    except Exception as e:
        print(t, 'ERR', e)
conn.close()
print('uploads dir:', os.listdir('uploads') if os.path.isdir('uploads') else None)
d = json.load(open('sitac_collo_data.json', encoding='utf-8'))
for k in ('sitac_records','gangguan_records','collo_records'):
    print('JSON', k, sum(1 for r in d.get(k, []) if r.get('foto_bukti')))
