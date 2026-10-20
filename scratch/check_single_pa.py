import sqlite3

conn = sqlite3.connect('telecom_portal.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute('SELECT * FROM sitac_records WHERE no_pa LIKE "%A821103000308-2%" OR terminating LIKE "%A821103000308-2%"')
rows = cur.fetchall()
for r in rows:
    print('ID:', r['id'])
    print('no_pa:', r['no_pa'])
    print('pelanggan:', r['pelanggan'])
    print('ptl:', r['ptl'])
    print('terminating:', r['terminating'])
    print('biaya_permintaan_awal:', r['biaya_permintaan_awal'])
    print('biaya_final:', r['biaya_final'])
    print('efisiensi_rupiah:', r['efisiensi_rupiah'])
    print('efisiensi_persen:', r['efisiensi_persen'])
    print('is_berbiaya:', r['is_berbiaya'])
    print('update_pekerjaan:\n', r['update_pekerjaan'])
