import sqlite3

conn = sqlite3.connect('telecom_portal.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

c.execute("SELECT * FROM rekap_efisiensi ORDER BY tahun ASC")
rows = [dict(r) for r in c.fetchall()]
for r in rows:
    print(r)
    print(f"  Tahun {r['tahun']}: Nilai Awal = {r['nilai_awal']:,}, Nilai Akhir = {r['nilai_akhir']:,}")
    print(f"  Awal - Akhir = {r['nilai_awal'] - r['nilai_akhir']:,}")
    print(f"  Efisiensi Rupiah = {r['efisiensi_rupiah']:,} (Diff = {r['efisiensi_rupiah'] - (r['nilai_awal'] - r['nilai_akhir']):,})")
    print(f"  Efisiensi Persen = {r['efisiensi_persen']}%\n")
