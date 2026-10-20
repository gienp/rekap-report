import traceback
from server import TelecomPortalAPIHandler, get_db

conn = get_db()
cursor = conn.cursor()

# Test the queries with year = '2027'
year = '2027'
y_int = int(year)
collo_where = "WHERE (strftime('%Y', start_date) <= ? AND (end_date IS NULL OR strftime('%Y', end_date) >= ?))"
sitac_where = "WHERE tahun = ?"
gangguan_where = "WHERE strftime('%Y', tgl_dispos) = ?"
c_params = [year, year]
s_params = [y_int]
g_params = [year]

try:
    print("Test 1: collo stats")
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
    print("Collo stats:", c_stats)

    print("Test 2: sitac stats")
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
    print("Sitac stats:", s_stats)

    # Let's test lines 1060-1200 of server.py
    # Let's inspect where the error happens
except Exception as e:
    traceback.print_exc()
