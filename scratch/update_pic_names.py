import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

name_map = {
    'budi.rodiyah': 'Budi Rodiyah',
    'edi.swargaloka': 'Edi Swargaloka',
    'harlan.zaelani': 'Harlan Zaelani',
    'zulhadi.syahril': 'Zulhadi Syahril',
    'zulhadi syahril': 'Zulhadi Syahril',
    'muhidin.shelay': 'Muhidin Shelay',
    'brian.ariyanto': 'Brian Ariyanto',
    'agih.gahara': 'Agih Gahara',
    'hairul.aswan': 'Hairul Aswan',
    'yudiansyah': 'Yudiansyah',
    'muhamad abusopian': 'Muhamad Abusopian',
    'muhammad abusopian': 'Muhamad Abusopian'
}

for old_name, new_name in name_map.items():
    c.execute('UPDATE sitac_records SET pic_perijinan = ? WHERE LOWER(pic_perijinan) = ?', (new_name, old_name.lower()))
    c.execute('UPDATE gangguan_records SET pic_perijinan = ? WHERE LOWER(pic_perijinan) = ?', (new_name, old_name.lower()))

c.execute("UPDATE gangguan_records SET pic_perijinan = 'Muhidin, Edi Swargaloka, Zulhadi Syahril' WHERE pic_perijinan = 'Muhidin, Edi Swargaloka, zulhadi syahril'")

conn.commit()

print('=== UPDATED SITAC PICS ===')
for r in c.execute('SELECT DISTINCT pic_perijinan, COUNT(*) FROM sitac_records GROUP BY pic_perijinan ORDER BY COUNT(*) DESC').fetchall():
    print('  ', r)

print('\n=== UPDATED GANGGUAN PICS ===')
for r in c.execute('SELECT DISTINCT pic_perijinan, COUNT(*) FROM gangguan_records GROUP BY pic_perijinan ORDER BY COUNT(*) DESC').fetchall():
    print('  ', r)
