import sys
sys.path.append('.')
import traceback
from server import get_db

conn = get_db()
cursor = conn.cursor()

year = '2027'
y_int = int(year)
collo_where = "WHERE (strftime('%Y', start_date) <= ? AND (end_date IS NULL OR strftime('%Y', end_date) >= ?))"
sitac_where = "WHERE tahun = ?"
gangguan_where = "WHERE strftime('%Y', tgl_dispos) = ?"
c_params = [year, year]
s_params = [y_int]
g_params = [year]

try:
    cursor.execute(f"""
        SELECT 
            COUNT(*) as total_records,
            SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_count,
            SUM(CASE WHEN status = 'NON ACTIVE' THEN 1 ELSE 0 END) as non_active_count,
            SUM(CASE WHEN status = 'DEACTIVASI' THEN 1 ELSE 0 END) as deactivasi_count,
            SUM(CASE WHEN status = 'ACTIVE' THEN rev_sewa_tahun ELSE 0 END) as active_revenue,
            SUM(CASE WHEN status = 'ACTIVE' THEN biaya_sewa_tahun ELSE 0 END) as active_biaya,
            SUM(CASE WHEN status = 'ACTIVE' THEN margin_rupiah ELSE 0 END) as active_margin,
            SUM(CASE WHEN rev_sharing_pct > 0 THEN 1 ELSE 0 END) as rev_sharing_count,
            SUM(CASE WHEN status = 'ACTIVE' AND alert_category = 'CRITICAL' THEN 1 ELSE 0 END) as critical_alerts_count,
            SUM(biaya_rev_sharing) as total_rev_sharing_cost
        FROM collo_records
        {collo_where}
    """, c_params)
    c_stats = dict(cursor.fetchone())

    cursor.execute(f"""
        SELECT 
            COUNT(*) as total_pa,
            SUM(CASE WHEN progress = 'Finish' THEN 1 ELSE 0 END) as finish_count,
            SUM(CASE WHEN progress = 'Ongoing' THEN 1 ELSE 0 END) as ongoing_count,
            SUM(CASE WHEN progress = 'Hold' THEN 1 ELSE 0 END) as hold_count,
            SUM(CASE WHEN progress = 'Cancel' THEN 1 ELSE 0 END) as cancel_count,
            SUM(biaya_permintaan_awal) as total_biaya_awal,
            SUM(biaya_final) as total_biaya_final,
            SUM(efisiensi_rupiah) as total_efisiensi_rupiah,
            AVG(CASE WHEN durasi_hari IS NOT NULL AND durasi_hari >= 0 THEN durasi_hari ELSE NULL END) as avg_sla_hari
        FROM sitac_records
        {sitac_where}
    """, s_params)
    s_stats = dict(cursor.fetchone())

    cursor.execute(f"""
        SELECT 
            COUNT(*) as total_gangguan,
            SUM(CASE WHEN is_selesai = 1 THEN 1 ELSE 0 END) as selesai_count,
            SUM(CASE WHEN is_selesai = 0 THEN 1 ELSE 0 END) as aktif_count
        FROM gangguan_records
        {gangguan_where}
    """, g_params)
    g_stats = dict(cursor.fetchone())

    collo_active_where = f"{collo_where} AND status = 'ACTIVE' AND pengelola != ''" if collo_where else "WHERE status = 'ACTIVE' AND pengelola != ''"
    cursor.execute(f"""
        SELECT 
            pengelola,
            COUNT(*) as sirkuit_count,
            SUM(biaya_sewa_tahun) as total_biaya,
            SUM(rev_sewa_tahun) as total_rev,
            SUM(margin_rupiah) as total_margin
        FROM collo_records
        {collo_active_where}
        GROUP BY pengelola
        ORDER BY total_biaya DESC
        LIMIT 10
    """, c_params)
    top_pengelola = [dict(r) for r in cursor.fetchall()]

    sitac_trend_where = f"{sitac_where} AND bulan IS NOT NULL" if sitac_where else "WHERE tahun IN (2024, 2025, 2026) AND bulan IS NOT NULL"
    cursor.execute(f"""
        SELECT 
            tahun, bulan,
            COUNT(*) as count_masuk,
            SUM(CASE WHEN progress = 'Finish' THEN 1 ELSE 0 END) as count_selesai
        FROM sitac_records
        {sitac_trend_where}
        GROUP BY tahun, bulan
        ORDER BY tahun, bulan
    """, s_params if sitac_where else [])
    monthly_trend = [dict(r) for r in cursor.fetchall()]

    cursor.execute(f"""
        SELECT COALESCE(NULLIF(jenis_sewa, ''), 'Lainnya') as jenis, COUNT(*) as cnt, SUM(rev_sewa_tahun) as rev, SUM(biaya_sewa_tahun) as biaya
        FROM collo_records {collo_active_where}
        GROUP BY jenis ORDER BY cnt DESC LIMIT 6
    """, c_params)
    jenis_sewa_dist = [dict(r) for r in cursor.fetchall()]

    cursor.execute(f"""
        SELECT status, COUNT(*) as cnt, SUM(rev_sewa_tahun) as rev
        FROM collo_records {collo_where} GROUP BY status
    """, c_params)
    collo_status_dist = [dict(r) for r in cursor.fetchall()]

    cursor.execute(f"""
        SELECT alert_category, COUNT(*) as cnt
        FROM collo_records {collo_active_where} GROUP BY alert_category
    """, c_params)
    expiration_dist = [dict(r) for r in cursor.fetchall()]

    sitac_aging_where = f"{sitac_where} AND durasi_hari IS NOT NULL AND durasi_hari >= 0" if sitac_where else "WHERE durasi_hari IS NOT NULL AND durasi_hari >= 0"
    cursor.execute(f"""
        SELECT 
            SUM(CASE WHEN durasi_hari <= 7 THEN 1 ELSE 0 END) as green,
            SUM(CASE WHEN durasi_hari > 7 AND durasi_hari <= 14 THEN 1 ELSE 0 END) as yellow,
            SUM(CASE WHEN durasi_hari > 14 THEN 1 ELSE 0 END) as red
        FROM sitac_records {sitac_aging_where}
    """, s_params if sitac_where else [])
    sitac_aging_dist = dict(cursor.fetchone() or {})

    cursor.execute("""
        SELECT 
            CASE CAST(bulan AS INTEGER)
                WHEN 1 THEN 'Jan'
                WHEN 2 THEN 'Feb'
                WHEN 3 THEN 'Mar'
                WHEN 4 THEN 'Apr'
                WHEN 5 THEN 'Mei'
                WHEN 6 THEN 'Jun'
                WHEN 7 THEN 'Jul'
                WHEN 8 THEN 'Agu'
                WHEN 9 THEN 'Sep'
                WHEN 10 THEN 'Okt'
                WHEN 11 THEN 'Nov'
                WHEN 12 THEN 'Des'
                ELSE printf('Bln %d', bulan)
            END as tahun,
            SUM(biaya_permintaan_awal) as nilai_awal,
            SUM(biaya_final) as nilai_akhir,
            SUM(efisiensi_rupiah) as efisiensi_rupiah,
            ROUND(SUM(efisiensi_rupiah) * 100.0 / NULLIF(SUM(biaya_permintaan_awal), 0), 2) as efisiensi_persen
        FROM sitac_records
        WHERE tahun = ? AND bulan IS NOT NULL
        GROUP BY bulan
        ORDER BY CAST(bulan AS INTEGER) ASC
    """, [int(year)])
    rekap_efisiensi_list = [dict(r) for r in cursor.fetchall()]

    cursor.execute(f"""
        SELECT pengelola, COUNT(*) as sirkuit_count, SUM(rev_sewa_tahun) as rev
        FROM collo_records {collo_active_where}
        GROUP BY pengelola ORDER BY sirkuit_count DESC LIMIT 8
    """, c_params)
    top_collo_vendors = [dict(r) for r in cursor.fetchall()]

    print("Success running all queries!")
except Exception as e:
    traceback.print_exc()
