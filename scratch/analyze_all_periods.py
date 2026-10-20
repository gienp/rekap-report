import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

c.execute("""
    SELECT 
        COUNT(*) as total_active,
        SUM(CASE WHEN strftime('%Y', start_date) = '2024' THEN 1 ELSE 0 END) as start_2024,
        SUM(CASE WHEN strftime('%Y', start_date) = '2025' THEN 1 ELSE 0 END) as start_2025,
        SUM(CASE WHEN strftime('%Y', start_date) = '2026' THEN 1 ELSE 0 END) as start_2026,
        SUM(CASE WHEN strftime('%Y', start_date) < '2024' THEN 1 ELSE 0 END) as start_before_2024,
        SUM(CASE WHEN start_date IS NULL THEN 1 ELSE 0 END) as start_null
    FROM collo_records
    WHERE status = 'ACTIVE'
""")
res = c.fetchone()
print("TOTAL SIRKUIT AKTIF FISIK DI DATABASE:", res[0])
print("Mulai 2024        :", res[1])
print("Mulai 2025        :", res[2])
print("Mulai 2026        :", res[3])
print("Mulai < 2024      :", res[4])
print("Start date NULL   :", res[5])
print("Total Sum Distinct :", sum(x for x in res[1:] if x is not None))

print("\n--- ANALISIS KONTRAK MULTI-YEAR (OVERLAP ANTAR TAHUN) ---")
# Cek berapa sirkuit yang aktif di lebih dari 1 tahun
c.execute("""
    SELECT id, no_so, pelanggan, start_date, end_date, rev_sewa_tahun
    FROM collo_records
    WHERE status = 'ACTIVE'
""")
rows = c.fetchall()

active_in_2024 = set()
active_in_2025 = set()
active_in_2026 = set()

for r in rows:
    rid, no_so, pel, s_date, e_date, rev = r
    sy = int(s_date[:4]) if s_date and len(s_date) >= 4 and s_date[:4].isdigit() else 2024
    ey = int(e_date[:4]) if e_date and len(e_date) >= 4 and e_date[:4].isdigit() else 2026
    
    if sy <= 2024 and ey >= 2024:
        active_in_2024.add(rid)
    if sy <= 2025 and ey >= 2025:
        active_in_2025.add(rid)
    if sy <= 2026 and ey >= 2026:
        active_in_2026.add(rid)

print(f"Sirkuit aktif di 2024 : {len(active_in_2024)}")
print(f"Sirkuit aktif di 2025 : {len(active_in_2025)}")
print(f"Sirkuit aktif di 2026 : {len(active_in_2026)}")
sum_tahunan = len(active_in_2024) + len(active_in_2025) + len(active_in_2026)
print(f"Penjumlahan 2024 + 2025 + 2026 : {sum_tahunan}")

overlap_24_25 = active_in_2024.intersection(active_in_2025)
overlap_25_26 = active_in_2025.intersection(active_in_2026)
overlap_all_3 = active_in_2024.intersection(active_in_2025).intersection(active_in_2026)

print(f"Sirkuit yang aktif di 2024 DAN 2025 : {len(overlap_24_25)} sirkuit")
print(f"Sirkuit yang aktif di 2025 DAN 2026 : {len(overlap_25_26)} sirkuit")
print(f"Sirkuit yang aktif di KETIGA TAHUN (2024, 2025, 2026) : {len(overlap_all_3)} sirkuit")

total_unik = len(active_in_2024.union(active_in_2025).union(active_in_2026))
print(f"\nTOTAL SIRKUIT UNIK (DEDUPED / SEMUA PERIODE) : {total_unik}")
