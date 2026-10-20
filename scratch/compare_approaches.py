import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

# Approach A: Just setting ef = aw - fin on current data
print("=== APPROACH A: Direct difference aw - fin on current data ===")
c.execute("""
    SELECT 
        SUM(biaya_permintaan_awal) as tot_awal,
        SUM(biaya_final) as tot_final
    FROM sitac_records
""")
r = c.fetchone()
tot_awal = r[0]
tot_final = r[1]
ef_a = tot_awal - tot_final
pct_a = (ef_a / tot_awal * 100) if tot_awal > 0 else 0
print(f"Total Awal: {tot_awal:,}")
print(f"Total Final: {tot_final:,}")
print(f"Efisiensi: {ef_a:,} ({pct_a:.2f}%)")

# Approach B: If unnegotiated paid projects have awal = final
print("\n=== APPROACH B: If unnegotiated paid projects have awal = final ===")
c.execute("""
    SELECT 
        SUM(CASE WHEN biaya_permintaan_awal = 0 AND biaya_final > 0 THEN biaya_final ELSE biaya_permintaan_awal END) as tot_awal_b,
        SUM(biaya_final) as tot_final_b,
        SUM(efisiensi_rupiah) as tot_ef_b
    FROM sitac_records
""")
r_b = c.fetchone()
tot_awal_b = r_b[0]
tot_final_b = r_b[1]
ef_b = tot_awal_b - tot_final_b
pct_b = (ef_b / tot_awal_b * 100) if tot_awal_b > 0 else 0
print(f"Total Awal: {tot_awal_b:,}")
print(f"Total Final: {tot_final_b:,}")
print(f"Efisiensi: {ef_b:,} ({pct_b:.2f}%)")
print(f"Sum of row efisiensi: {r_b[2]:,}")
