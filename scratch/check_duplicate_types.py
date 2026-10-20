import sqlite3
from collections import Counter

c_dedup = sqlite3.connect('telecom_portal_backup_before_dedup.db').cursor()
c_cur = sqlite3.connect('telecom_portal.db').cursor()

# Get deleted active rows
b_active = c_dedup.execute("SELECT id, pengelola, pelanggan, no_so, sid, originating, terminating, start_date, end_date, rev_sewa_tahun FROM collo_records WHERE status = 'ACTIVE'").fetchall()
cur_ids = set(r[0] for r in c_cur.execute("SELECT id FROM collo_records").fetchall())

deleted = [r for r in b_active if r[0] not in cur_ids]

print("=== TAHUN MULAI DARI 230 SIRKUIT AKTIF YANG DIHAPUS ===")
del_years = Counter()
for r in deleted:
    s_date = r[7]
    yr = s_date[:4] if s_date and len(s_date) >= 4 else 'Tanpa Tanggal'
    del_years[yr] += 1

for yr in sorted(del_years.keys()):
    print(f"  Tahun {yr}: {del_years[yr]} sirkuit dihapus")

print("\n=== DETAIL DUPLIKASI: APAKAH BEDA TAHUN ATAU TAHUN SAMA? ===")
# Check relationship between deleted row and kept row in current DB
diff_year_cnt = 0
same_year_cnt = 0
examples_diff_year = []
examples_same_year = []

for r in deleted:
    rid, pengelola, pelanggan, no_so, sid, orig, term, s_date, e_date, rev = r
    r_yr = s_date[:4] if s_date and len(s_date) >= 4 else 'Unknown'
    
    # Find matching kept master
    master = None
    if no_so and no_so.strip():
        m = c_cur.execute("SELECT id, start_date, end_date, status, rev_sewa_tahun, no_so, pengelola, pelanggan FROM collo_records WHERE TRIM(no_so) = ? AND TRIM(pengelola) = ?", (no_so.strip(), pengelola.strip())).fetchone()
        if m: master = m
    if not master and sid and sid.strip():
        m = c_cur.execute("SELECT id, start_date, end_date, status, rev_sewa_tahun, no_so, pengelola, pelanggan FROM collo_records WHERE TRIM(sid) = ? AND TRIM(pengelola) = ?", (sid.strip(), pengelola.strip())).fetchone()
        if m: master = m
    if not master and term and term.strip():
        m = c_cur.execute("SELECT id, start_date, end_date, status, rev_sewa_tahun, no_so, pengelola, pelanggan FROM collo_records WHERE TRIM(terminating) = ? AND TRIM(pengelola) = ?", (term.strip(), pengelola.strip())).fetchone()
        if m: master = m
        
    if master:
        m_sdate = master[1]
        m_yr = m_sdate[:4] if m_sdate and len(m_sdate) >= 4 else 'Unknown'
        if m_yr != r_yr:
            diff_year_cnt += 1
            if len(examples_diff_year) < 5:
                examples_diff_year.append((r, master))
        else:
            same_year_cnt += 1
            if len(examples_same_year) < 5:
                examples_same_year.append((r, master))

print(f"Duplikat antara TAHUN YANG BERBEDA (Multi-Tahun / Perpanjangan): {diff_year_cnt} sirkuit")
print(f"Duplikat di TAHUN YANG SAMA (Double Entry di Tahun Sama): {same_year_cnt} sirkuit")

print("\n--- Contoh Duplikat BEDA TAHUN (Multi-Year / Perpanjangan Kontrak) ---")
for d, m in examples_diff_year:
    print(f"  Sirkuit Dihapus: ID {d[0]} | SO: {d[3]} | Pelanggan: {d[2]} | Periode: {d[7]} s/d {d[8]}")
    print(f"  -> Master Disimpan: ID {m[0]} | SO: {m[5]} | Pelanggan: {m[7]} | Periode: {m[1]} s/d {m[2]} (Status: {m[3]})")
    print()

print("\n--- Contoh Duplikat TAHUN SAMA (Double Entry di Tahun Sama) ---")
for d, m in examples_same_year:
    print(f"  Sirkuit Dihapus: ID {d[0]} | SO: {d[3]} | Pelanggan: {d[2]} | Periode: {d[7]} s/d {d[8]}")
    print(f"  -> Master Disimpan: ID {m[0]} | SO: {m[5]} | Pelanggan: {m[7]} | Periode: {m[1]} s/d {m[2]} (Status: {m[3]})")
    print()
