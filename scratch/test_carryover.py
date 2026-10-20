import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

for y in ['2024', '2025', '2026', 'ALL']:
    if y == 'ALL':
        c.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) as act
            FROM collo_records
        """)
        r = c.fetchone()
        print(f"ALL: Total={r[0]}, Active={r[1]}")
    else:
        c.execute("""
            SELECT 
                SUM(CASE WHEN status='ACTIVE' AND (strftime('%Y', start_date) <= ? AND (end_date IS NULL OR strftime('%Y', end_date) >= ?)) THEN 1 ELSE 0 END) as act,
                SUM(CASE WHEN status='ACTIVE' AND strftime('%Y', start_date) = ? AND (end_date IS NULL OR strftime('%Y', end_date) >= ?) THEN 1 ELSE 0 END) as new_act,
                SUM(CASE WHEN status='ACTIVE' AND strftime('%Y', start_date) < ? AND (end_date IS NULL OR strftime('%Y', end_date) >= ?) THEN 1 ELSE 0 END) as carry_act
            FROM collo_records
        """, [y, y, y, y, y, y])
        r = c.fetchone()
        print(f"{y}: Active={r[0]}, New={r[1]}, CarryOver={r[2]} (Sum check: {r[1]} + {r[2]} = {r[1]+r[2]})")
