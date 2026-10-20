import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

c.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables:", [r[0] for r in c.fetchall()])

c.execute("SELECT COUNT(*), SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) FROM collo_records")
total_rows, active_rows = c.fetchone()
print(f"collo_records Total: {total_rows}, Active: {active_rows}")

years = ['ALL', '2024', '2025', '2026', '2027']
for y in years:
    if y == 'ALL':
        c.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as act,
                SUM(CASE WHEN status = 'ACTIVE' THEN rev_sewa_tahun ELSE 0 END) as rev,
                SUM(CASE WHEN status = 'ACTIVE' THEN margin_rupiah ELSE 0 END) as margin
            FROM collo_records
        """)
    else:
        c.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as act,
                SUM(CASE WHEN status = 'ACTIVE' THEN rev_sewa_tahun ELSE 0 END) as rev,
                SUM(CASE WHEN status = 'ACTIVE' THEN margin_rupiah ELSE 0 END) as margin
            FROM collo_records
            WHERE (strftime('%Y', start_date) <= ? AND (end_date IS NULL OR strftime('%Y', end_date) >= ?))
        """, [y, y])
    res = c.fetchone()
    print(f"Year {y}: Total={res[0]}, Active={res[1]}, Rev={res[2]:,}, Margin={res[3]:,}")
