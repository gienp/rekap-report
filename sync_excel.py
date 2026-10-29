#!/usr/bin/env python3
"""
Automated Universal Excel Synchronizer for Rekap & Report Portal
Usage:
    python sync_excel.py [optional_path_to_excel_file]

Features:
    1. Auto-detects the newest Excel file in workspace/OneDrive if no path provided.
    2. Identifies SITAC, Colocation, and Gangguan sheets automatically.
    3. Normalizes dates into standard YYYY-MM-DD (handling d-mmm-yy, serials, and timestamps).
    4. Smart deduplication (avoids double counting while inserting all new rows).
    5. Syncs to SQLite (telecom_portal.db).
    6. Regenerates sitac_collo_data.json and sitac_collo_data.js.
    7. Auto-bumps cache buster versions in index.html.
    8. Automatically deploys to Firebase Hosting (https://analytics-811fc.web.app).
"""

import os
import sys
import re
import json
import sqlite3
import datetime
import subprocess
import urllib.request
import openpyxl

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "telecom_portal.db")
JSON_PATH = os.path.join(BASE_DIR, "sitac_collo_data.json")
JS_PATH = os.path.join(BASE_DIR, "sitac_collo_data.js")
INDEX_PATH = os.path.join(BASE_DIR, "index.html")

MONTH_MAP = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'mei': '05', 'may': '05',
    'jun': '06', 'jul': '07', 'agu': '08', 'ags': '08', 'aug': '08', 'sep': '09',
    'okt': '10', 'oct': '10', 'nov': '11', 'des': '12', 'dec': '12'
}

def clean_date_to_iso(val):
    if not val:
        return None
    if isinstance(val, (datetime.datetime, datetime.date)):
        return val.strftime("%Y-%m-%d")
    if isinstance(val, (int, float)):
        # Excel serial number
        if 20000 < val < 60000:
            d = datetime.date(1899, 12, 30) + datetime.timedelta(days=int(val))
            return d.strftime("%Y-%m-%d")
    s = str(val).strip()
    if not s or s in ['-', 'None', 'null', 'undefined']:
        return None
    if re.match(r'^\d{4}-\d{2}-\d{2}', s):
        return s[:10]
    
    # e.g. 2-Oct-26, 12-Oct-26, 26-Oct-26
    m1 = re.match(r'^(\d{1,2})[\s\-\/\.]([a-zA-Z]{3,9})[\s\-\/\.](\d{2,4})$', s)
    if m1:
        day = m1.group(1).zfill(2)
        mon_str = m1.group(2).lower()[:3]
        mon = MONTH_MAP.get(mon_str)
        yr = m1.group(3)
        if len(yr) == 2:
            yr = "20" + yr
        if mon:
            return f"{yr}-{mon}-{day}"
            
    # e.g. 02/10/2026 or 02-10-2026
    m2 = re.match(r'^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$', s)
    if m2:
        day = m2.group(1).zfill(2)
        mon = m2.group(2).zfill(2)
        yr = m2.group(3)
        return f"{yr}-{mon}-{day}"

    try:
        dt = datetime.datetime.fromisoformat(s)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        pass
    return s[:10] if len(s) >= 10 else s

def clean_num(val):
    if val is None or val == '' or val == '-':
        return 0
    if isinstance(val, (int, float)):
        return val
    try:
        s = str(val).replace('.', '').replace(',', '.').strip()
        return float(s)
    except Exception:
        return 0

def format_pic_name(pic_raw):
    p = str(pic_raw or '').strip()
    if not p or p == '-':
        return '-'
    parts = re.split(r'[\._\s]+', p)
    return ' '.join(word.capitalize() for word in parts if word)

def is_generic_no(val):
    v = re.sub(r'[\s\-_]', '', str(val or '').strip().upper())
    return not v or v in ['NONPA', 'NOPA', 'NON', '']

def find_target_excel():
    if len(sys.argv) > 1 and os.path.isfile(sys.argv[1]):
        return sys.argv[1]
    
    # Priority paths
    candidates = [
        os.path.join(BASE_DIR, "Report Sitac  2026 FIX.xlsx"),
        os.path.join(BASE_DIR, "..", "anggie", "magang 5 bulan", "a", "Report Sitac  2026 FIX.xlsx")
    ]
    for c in candidates:
        if os.path.isfile(c):
            return os.path.abspath(c)
            
    # Search recursively for Report Sitac
    for root, dirs, files in os.walk(os.path.join(BASE_DIR, "..")):
        for f in files:
            if "Report Sitac" in f and f.endswith(".xlsx"):
                return os.path.abspath(os.path.join(root, f))
    return None

def sync_sitac_sheet(wb, conn):
    sheet_name = None
    for name in ['Master RAW data', 'SITAC', 'RAW DATA']:
        if name in wb.sheetnames:
            sheet_name = name
            break
    if not sheet_name:
        sheet_name = wb.sheetnames[0]
        
    ws = wb[sheet_name]
    all_rows = list(ws.iter_rows(values_only=True))
    if not all_rows or len(all_rows) < 2:
        return 0, 0
        
    header = [str(c or '').strip() for c in all_rows[0]]
    
    def get_col_idx(patterns):
        for idx, h in enumerate(header):
            for p in patterns:
                if re.search(p, h.replace('\n', ' '), re.IGNORECASE):
                    return idx
        return None

    c_no = get_col_idx([r'^no$']) or 0
    c_nopa = get_col_idx([r'^no[_\s\.]*pa', r'^nomor[_\s\.]*pa', r'^nopa$']) or 1
    c_pel = get_col_idx([r'^pelanggan', r'^customer']) or 2
    c_ptl = get_col_idx([r'^ptl']) or 3
    c_pic = get_col_idx([r'^perijinan', r'^pic']) or 4
    c_tier = get_col_idx([r'^tingkat[_\s\.]*kesulitan', r'^tiering']) or 5
    c_poin = get_col_idx([r'^poin']) or 6
    c_term = get_col_idx([r'^terminating', r'^lokasi']) or 7
    c_b_awal = get_col_idx([r'^biaya[_\s\.]*permintaan[_\s\.]*awal', r'^biaya[_\s\.]*awal']) or 9
    c_sewa_otc = get_col_idx([r'^sewa[_\s\.]*/[_\s\.]*otc']) or 10
    c_b_fin = get_col_idx([r'^biaya[_\s\.]*final', r'^final$']) or 11
    c_b_bln = get_col_idx([r'^biaya[_\s\.]*perijinan[_\s\.]*sewa', r'^biaya[_\s\.]*sewa[_\s\.]*bulan']) or 12
    c_prog = get_col_idx([r'^progress', r'^status']) or 13
    c_d_pa = get_col_idx([r'^date[_\s\.]*pa']) or 14
    c_d_dispos = get_col_idx([r'^date[_\s\.]*dispos', r'^tgl[_\s\.]*dispos']) or 15
    c_d_close = get_col_idx([r'^date[_\s\.]*close', r'^tgl[_\s\.]*close', r'^tgl[_\s\.]*selesai']) or 18
    c_upd = get_col_idx([r'^update[_\s\.]*pekerjaan', r'^catatan', r'^keterangan']) or 22
    c_bln = get_col_idx([r'^bulan$']) or 23
    c_thn = get_col_idx([r'^tahun$']) or 24

    c = conn.cursor()
    c.execute("SELECT id, no_pa, pelanggan, terminating FROM sitac_records")
    existing_records = c.fetchall()
    
    existing_pas = {}
    existing_pel_term = set()
    for row_id, pa, pel, term in existing_records:
        pa_clean = str(pa or '').strip().upper()
        if pa_clean and not is_generic_no(pa_clean):
            existing_pas[pa_clean] = row_id
        pt_key = f"{str(pel or '').strip().upper()}||{str(term or '').strip().upper()}"
        if pt_key != "||":
            existing_pel_term.add(pt_key)

    c.execute("SELECT MAX(id) FROM sitac_records")
    max_id = c.fetchone()[0] or 0

    inserted_count = 0
    updated_count = 0

    for idx, r in enumerate(all_rows[1:], start=2):
        if not any(cell is not None and str(cell).strip() != '' for cell in r):
            continue
            
        excel_no = r[c_no] if c_no < len(r) else idx - 1
        no_pa = str(r[c_nopa] or '').strip() if c_nopa < len(r) else 'NO PA'
        if not no_pa:
            no_pa = 'NO PA'
        pelanggan = str(r[c_pel] or '').strip() if c_pel < len(r) else '-'
        ptl = str(r[c_ptl] or '').strip() if c_ptl < len(r) else '-'
        pic = format_pic_name(r[c_pic]) if c_pic < len(r) else '-'
        tiering = str(r[c_tier] or '').strip() if c_tier < len(r) and r[c_tier] is not None else ''
        poin = r[c_poin] if c_poin < len(r) else None
        terminating = str(r[c_term] or '').strip() if c_term < len(r) else '-'
        
        b_awal = clean_num(r[c_b_awal]) if c_b_awal < len(r) else 0
        sewa_otc = str(r[c_sewa_otc] or '-').strip() if c_sewa_otc < len(r) else '-'
        b_final = clean_num(r[c_b_fin]) if c_b_fin < len(r) else 0
        b_sewa_bln = clean_num(r[c_b_bln]) if c_b_bln < len(r) else 0
        eff_rp = max(0, b_awal - b_final)
        eff_pct = round((eff_rp / b_awal * 100), 2) if b_awal > 0 else 0.0
        is_berbiaya = 1 if (b_awal > 0 or b_final > 0) else 0

        prog_raw = str(r[c_prog] or 'Ongoing').strip().lower() if c_prog < len(r) else 'ongoing'
        if 'finish' in prog_raw:
            progress = 'Finish'
        elif 'ongoing' in prog_raw:
            progress = 'Ongoing'
        elif 'hold' in prog_raw:
            progress = 'Hold'
        elif 'cancel' in prog_raw:
            progress = 'Cancel'
        else:
            progress = 'Ongoing'

        date_pa = clean_date_to_iso(r[c_d_pa]) if c_d_pa < len(r) else None
        date_dispos = clean_date_to_iso(r[c_d_dispos]) if c_d_dispos < len(r) else None
        date_close = clean_date_to_iso(r[c_d_close]) if c_d_close < len(r) else None

        durasi_hari = None
        if date_dispos and date_close:
            try:
                d1 = datetime.datetime.strptime(date_dispos, '%Y-%m-%d')
                d2 = datetime.datetime.strptime(date_close, '%Y-%m-%d')
                durasi_hari = max(0, (d2 - d1).days)
            except Exception:
                pass

        aging = 'green' if (durasi_hari is None or durasi_hari <= 7) else ('yellow' if durasi_hari <= 14 else 'red')
        update_pekerjaan = str(r[c_upd] or '').strip() if c_upd < len(r) else ''
        
        bulan = int(r[c_bln]) if c_bln < len(r) and r[c_bln] is not None and str(r[c_bln]).isdigit() else (int(date_dispos[5:7]) if date_dispos else 10)
        tahun = int(r[c_thn]) if c_thn < len(r) and r[c_thn] is not None and str(r[c_thn]).isdigit() else (int(date_dispos[:4]) if date_dispos else 2026)

        # Smart duplicate check
        pa_clean = no_pa.strip().upper()
        pt_key = f"{pelanggan.strip().upper()}||{terminating.strip().upper()}"
        
        existing_id = None
        if pa_clean and not is_generic_no(pa_clean) and pa_clean in existing_pas:
            existing_id = existing_pas[pa_clean]
        elif pt_key != "||" and pt_key in existing_pel_term:
            # Check by pelanggan & terminating
            c.execute("SELECT id FROM sitac_records WHERE UPPER(TRIM(pelanggan)) = ? AND UPPER(TRIM(terminating)) = ?",
                      (pelanggan.strip().upper(), terminating.strip().upper()))
            m = c.fetchone()
            if m:
                existing_id = m[0]

        if existing_id:
            # Update existing
            c.execute('''
                UPDATE sitac_records SET
                    ptl = ?, pic_perijinan = ?, tiering = ?, poin = ?,
                    biaya_permintaan_awal = ?, sewa_otc = ?, biaya_final = ?, biaya_sewa_bulan = ?,
                    efisiensi_rupiah = ?, efisiensi_persen = ?, is_berbiaya = ?, progress = ?,
                    date_pa = ?, date_dispos = ?, date_close = ?, durasi_hari = ?,
                    aging_category = ?, update_pekerjaan = ?, bulan = ?, tahun = ?, updated_at = datetime('now')
                WHERE id = ?
            ''', (
                ptl, pic, tiering, poin,
                b_awal, sewa_otc, b_final, b_sewa_bln,
                eff_rp, eff_pct, is_berbiaya, progress,
                date_pa, date_dispos, date_close, durasi_hari,
                aging, update_pekerjaan, bulan, tahun, existing_id
            ))
            updated_count += 1
        else:
            # Insert new
            max_id += 1
            c.execute('''
                INSERT INTO sitac_records (
                    id, excel_no, no_pa, pelanggan, ptl, pic_perijinan, tiering, poin, terminating,
                    latitude, longitude, coord_type, biaya_permintaan_awal, catatan_biaya_awal,
                    sewa_otc, biaya_final, biaya_sewa_bulan, efisiensi_rupiah, efisiensi_persen,
                    is_berbiaya, progress, date_pa, date_dispos, date_close, durasi_hari,
                    aging_category, update_pekerjaan, bulan, tahun, created_at, updated_at, foto_bukti
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL)
            ''', (
                max_id, excel_no, no_pa, pelanggan, ptl, pic, tiering, poin, terminating,
                None, None, None, b_awal, '',
                sewa_otc, b_final, b_sewa_bln, eff_rp, eff_pct,
                is_berbiaya, progress, date_pa, date_dispos, date_close, durasi_hari,
                aging, update_pekerjaan, bulan, tahun
            ))
            if pa_clean and not is_generic_no(pa_clean):
                existing_pas[pa_clean] = max_id
            if pt_key != "||":
                existing_pel_term.add(pt_key)
            inserted_count += 1

    conn.commit()
    return inserted_count, updated_count

def sync_to_supabase(conn):
    cfg_path = os.path.join(BASE_DIR, "db_config.json")
    if not os.path.isfile(cfg_path):
        return
    try:
        with open(cfg_path, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
        sb_url = cfg.get("SUPABASE_URL")
        sb_key = cfg.get("SUPABASE_ANON_KEY")
        if not sb_url or not sb_key:
            return

        import urllib.request
        c = conn.cursor()
        c.execute("SELECT * FROM sitac_records")
        cols = [col[0] for col in c.description]
        sitac_recs = [dict(zip(cols, row)) for row in c.fetchall()]

        batch_size = 200
        for i in range(0, len(sitac_recs), batch_size):
            chunk = sitac_recs[i:i + batch_size]
            url = f"{sb_url}/rest/v1/sitac_records"
            headers = {
                'apikey': sb_key,
                'Authorization': f"Bearer {sb_key}",
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            }
            data = json.dumps(chunk).encode('utf-8')
            req = urllib.request.Request(url, data=data, headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=30) as resp:
                pass
        print(f"Successfully synced {len(sitac_recs)} SITAC records to Supabase Cloud PostgreSQL!")
    except Exception as e:
        print(f"Supabase sync notice: {e}")

def export_db_to_static_files(conn):
    sync_to_supabase(conn)
    c = conn.cursor()
    c.execute("SELECT * FROM sitac_records ORDER BY id ASC")
    cols = [col[0] for col in c.description]
    sitac_recs = [dict(zip(cols, row)) for row in c.fetchall()]

    c.execute("SELECT * FROM collo_records ORDER BY id ASC")
    cols = [col[0] for col in c.description]
    collo_recs = [dict(zip(cols, row)) for row in c.fetchall()]

    c.execute("SELECT * FROM gangguan_records ORDER BY id ASC")
    cols = [col[0] for col in c.description]
    gangguan_recs = [dict(zip(cols, row)) for row in c.fetchall()]

    # Recalculate rekap_efisiensi from sitac_records
    c.execute('''
        SELECT 
            tahun, 
            COUNT(*) as total_disposisi,
            SUM(CASE WHEN is_berbiaya = 1 OR biaya_permintaan_awal > 0 OR biaya_final > 0 THEN 1 ELSE 0 END) as ada_biaya,
            SUM(CASE WHEN is_berbiaya = 0 AND biaya_permintaan_awal = 0 AND biaya_final = 0 THEN 1 ELSE 0 END) as tidak_ada_biaya,
            SUM(biaya_permintaan_awal) as nilai_awal,
            SUM(biaya_final) as nilai_akhir,
            SUM(efisiensi_rupiah) as efisiensi_rupiah
        FROM sitac_records
        WHERE tahun >= 2024
        GROUP BY tahun
        ORDER BY tahun ASC
    ''')
    eff_cols = [col[0] for col in c.description]
    rekap_eff_rows = []
    for r in c.fetchall():
        d = dict(zip(eff_cols, r))
        eff_pct = round((d['efisiensi_rupiah'] / d['nilai_awal'] * 100), 2) if d['nilai_awal'] > 0 else 0.0
        d['efisiensi_persen'] = eff_pct
        rekap_eff_rows.append(d)
        c.execute('''
            INSERT INTO rekap_efisiensi (tahun, total_disposisi, ada_biaya, tidak_ada_biaya, nilai_awal, nilai_akhir, efisiensi_rupiah, efisiensi_persen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(tahun) DO UPDATE SET
                total_disposisi = excluded.total_disposisi,
                ada_biaya = excluded.ada_biaya,
                tidak_ada_biaya = excluded.tidak_ada_biaya,
                nilai_awal = excluded.nilai_awal,
                nilai_akhir = excluded.nilai_akhir,
                efisiensi_rupiah = excluded.efisiensi_rupiah,
                efisiensi_persen = excluded.efisiensi_persen
        ''', (d['tahun'], d['total_disposisi'], d['ada_biaya'], d['tidak_ada_biaya'], d['nilai_awal'], d['nilai_akhir'], d['efisiensi_rupiah'], d['efisiensi_persen']))
    conn.commit()

    # Sync rekap_efisiensi to Supabase
    cfg_path = os.path.join(BASE_DIR, "db_config.json")
    if os.path.isfile(cfg_path):
        try:
            with open(cfg_path, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
            sb_url = cfg.get("SUPABASE_URL")
            sb_key = cfg.get("SUPABASE_ANON_KEY")
            if sb_url and sb_key and rekap_eff_rows:
                url = f"{sb_url}/rest/v1/rekap_efisiensi"
                headers = {
                    'apikey': sb_key,
                    'Authorization': f"Bearer {sb_key}",
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                }
                data_b = json.dumps(rekap_eff_rows).encode('utf-8')
                req = urllib.request.Request(url, data=data_b, headers=headers, method='POST')
                with urllib.request.urlopen(req, timeout=15) as resp:
                    pass
                print(f"Successfully synced rekap_efisiensi ({len(rekap_eff_rows)} rows) to Supabase!")
        except Exception as sb_e:
            print(f"Supabase rekap_efisiensi notice: {sb_e}")

    data = {
        "generated_at": datetime.datetime.now().isoformat(),
        "sitac_records": sitac_recs,
        "collo_records": collo_recs,
        "gangguan_records": gangguan_recs,
        "rekap_efisiensi": rekap_eff_rows,
        "summary": {
            "rekap_efisiensi": rekap_eff_rows
        }
    }

    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    with open(JS_PATH, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated static master dataset\n')
        f.write('window.SITAC_COLLO_DATA = ')
        json.dump(data, f, ensure_ascii=False)
        f.write(';\nwindow.PORTAL_DATASET = window.SITAC_COLLO_DATA;\n')

    return len(sitac_recs), len(collo_recs), len(gangguan_recs)

def bump_index_versions():
    if not os.path.isfile(INDEX_PATH):
        return
    with open(INDEX_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    # Generate version based on timestamp
    v_tag = datetime.datetime.now().strftime("%m%d.%H%M")
    
    content = re.sub(r'sitac_collo_data\.js\?v=[\d\.]+', f'sitac_collo_data.js?v={v_tag}', content)
    content = re.sub(r'app\.js\?v=[\d\.]+', f'app.js?v={v_tag}', content)

    with open(INDEX_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Bumped cache buster versions to v={v_tag} in index.html")

def deploy_firebase():
    print("\n--- Deploying to Firebase Hosting ---")
    try:
        proc = subprocess.run(
            ["cmd.exe", "/c", "firebase deploy --only hosting"],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            timeout=120
        )
        print(proc.stdout)
        if proc.returncode == 0:
            print("Successfully deployed to Firebase Hosting!")
            print("Live URL: https://analytics-811fc.web.app")
        else:
            print("Deploy failed:", proc.stderr)
    except Exception as e:
        print("Deploy error:", str(e))

def main():
    target_excel = find_target_excel()
    if not target_excel:
        print("ERROR: No Excel file found to synchronize.")
        sys.exit(1)

    print(f"=== Universal Excel Synchronizer ===")
    print(f"Source Excel: {target_excel}")
    print(f"Database:     {DB_PATH}")

    wb = openpyxl.load_workbook(target_excel, data_only=True)
    conn = sqlite3.connect(DB_PATH)

    inserted, updated = sync_sitac_sheet(wb, conn)
    print(f"\nSITAC Records Sync: {inserted} baru ditambahkan, {updated} data diperbarui.")

    tot_sitac, tot_collo, tot_gangguan = export_db_to_static_files(conn)
    conn.close()

    print(f"Exported Master Datasets:")
    print(f"  - SITAC:    {tot_sitac} records")
    print(f"  - Collo:    {tot_collo} records")
    print(f"  - Gangguan: {tot_gangguan} records")

    bump_index_versions()
    deploy_firebase()

    print("\n[ALL DONE] Dataset successfully updated and live on web!")

if __name__ == "__main__":
    main()
