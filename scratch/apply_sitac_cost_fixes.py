import sqlite3
import json
import os

DB_PATH = 'telecom_portal.db'
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# 1. Update the verified records
updates = [
    {
        'id': 522,
        'no_pa': 'A821103000441',
        'awal': 25000000,
        'final': 3000000,
        'ef_rp': 22000000,
        'ef_pct': 88.0,
        'is_berbiaya': 1
    },
    {
        'id': 490,
        'no_pa': 'A821103000309',
        'awal': 10000000,
        'final': 5000000,
        'ef_rp': 5000000,
        'ef_pct': 50.0,
        'is_berbiaya': 1
    },
    {
        'id': 491,
        'no_pa': 'A821103000295',
        'awal': 5000000,
        'final': 1500000,
        'ef_rp': 3500000,
        'ef_pct': 70.0,
        'is_berbiaya': 1
    },
    {
        'id': 506,
        'no_pa': 'A112601000347',
        'awal': 13000000,
        'final': 7800000,
        'ef_rp': 5200000,
        'ef_pct': 40.0,
        'is_berbiaya': 1
    },
    {
        'id': 563,
        'no_pa': 'A821103000320',
        'awal': 4000000,
        'final': 2000000,
        'ef_rp': 2000000,
        'ef_pct': 50.0,
        'is_berbiaya': 1
    },
    {
        'id': 487,
        'no_pa': 'A821103000306',
        'awal': 9500000,
        'final': 6000000,
        'ef_rp': 3500000,
        'ef_pct': 36.8,
        'is_berbiaya': 1
    },
    {
        'id': 530,
        'no_pa': 'A811303000553',
        'awal': 10000000,
        'final': 10000000,
        'ef_rp': 0,
        'ef_pct': 0.0,
        'is_berbiaya': 1
    },
    {
        'id': 536,
        'no_pa': 'A821103000287',
        'awal': 1000000,
        'final': 1000000,
        'ef_rp': 0,
        'ef_pct': 0.0,
        'is_berbiaya': 1
    },
    {
        'id': 529,
        'no_pa': 'A111401000956',
        'awal': 11500000,
        'final': 11500000,
        'ef_rp': 0,
        'ef_pct': 0.0,
        'is_berbiaya': 1
    }
]

print("Applying SITAC cost updates...")
for u in updates:
    c.execute("""
        UPDATE sitac_records
        SET biaya_permintaan_awal = ?,
            biaya_final = ?,
            efisiensi_rupiah = ?,
            efisiensi_persen = ?,
            is_berbiaya = ?
        WHERE id = ? OR no_pa = ?
    """, (u['awal'], u['final'], u['ef_rp'], u['ef_pct'], u['is_berbiaya'], u['id'], u['no_pa']))
    print(f"Updated ID {u['id']} ({u['no_pa']}): Awal={u['awal']:,}, Final={u['final']:,}, Ef={u['ef_rp']:,}")

conn.commit()

# 2. Recalculate rekap_efisiensi for 2024 from sitac_records
print("\nRecalculating 2024 rekap_efisiensi...")
c.execute("""
    SELECT 
        COUNT(id) as total_disp,
        SUM(CASE WHEN is_berbiaya = 1 OR biaya_final > 0 THEN 1 ELSE 0 END) as ada_biaya,
        SUM(CASE WHEN (is_berbiaya = 0 OR is_berbiaya IS NULL) AND (biaya_final = 0 OR biaya_final IS NULL) THEN 1 ELSE 0 END) as non_biaya,
        COALESCE(SUM(biaya_permintaan_awal), 0) as tot_awal,
        COALESCE(SUM(biaya_final), 0) as tot_akhir
    FROM sitac_records
    WHERE tahun = 2024 OR (date_pa LIKE '2024%')
""")
calc = c.fetchone()
tot_disp = calc['total_disp']
ada_b = calc['ada_biaya']
non_b = calc['non_biaya']
tot_awal = calc['tot_awal']
tot_akhir = calc['tot_akhir']
ef_rp = tot_awal - tot_akhir
ef_pct = round((ef_rp / tot_awal * 100), 1) if tot_awal > 0 else 0.0

print(f"2024 stats: Disp={tot_disp}, Berbiaya={ada_b}, ZeroCost={non_b}, Awal={tot_awal:,}, Akhir={tot_akhir:,}, Efisiensi={ef_rp:,} ({ef_pct}%)")

c.execute("""
    UPDATE rekap_efisiensi
    SET total_disposisi = ?,
        ada_biaya = ?,
        tidak_ada_biaya = ?,
        nilai_awal = ?,
        nilai_akhir = ?,
        efisiensi_rupiah = ?,
        efisiensi_persen = ?
    WHERE tahun = 2024
""", (tot_disp, ada_b, non_b, tot_awal, tot_akhir, ef_rp, ef_pct))

conn.commit()

# 3. Read full sitac_records & rekap_efisiensi to sync JSON & JS
print("\nSyncing sitac_collo_data.json and sitac_collo_data.js...")
c.execute("SELECT * FROM sitac_records ORDER BY id ASC")
all_sitac = [dict(r) for r in c.fetchall()]

c.execute("SELECT * FROM rekap_efisiensi ORDER BY tahun ASC")
all_efisiensi = [dict(r) for r in c.fetchall()]

# Load sitac_collo_data.json
with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    master_json = json.load(f)

master_json['sitac_records'] = all_sitac
master_json['rekap_efisiensi'] = all_efisiensi

with open('sitac_collo_data.json', 'w', encoding='utf-8') as f:
    json.dump(master_json, f, indent=2, ensure_ascii=False)
print("Updated sitac_collo_data.json")

# Update sitac_collo_data.js
js_content = "window.SITAC_COLLO_DATA = " + json.dumps(master_json, indent=2, ensure_ascii=False) + ";\n"
with open('sitac_collo_data.js', 'w', encoding='utf-8') as f:
    f.write(js_content)
print("Updated sitac_collo_data.js")

conn.close()
print("All updates successfully applied!")
