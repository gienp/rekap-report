import sqlite3
from collections import Counter

def analyze_db(db_name):
    conn = sqlite3.connect(db_name)
    c = conn.cursor()
    
    print(f"\n=======================================================")
    print(f"ANALYSIS OF: {db_name}")
    print(f"=======================================================")
    
    # 1. Total ACTIVE rows
    c.execute("SELECT count(*) FROM collo_records WHERE status = 'ACTIVE'")
    total_active = c.fetchone()[0]
    print(f"Total ACTIVE rows: {total_active}")
    
    # 2. Year distribution by start_date
    c.execute("""
        SELECT 
            CASE 
                WHEN start_date IS NULL OR TRIM(start_date) = '' THEN 'Tanpa Tanggal Mulai'
                WHEN start_date LIKE '____-__-__%' THEN SUBSTR(start_date, 1, 4)
                ELSE 'Format Lain'
            END as yr,
            COUNT(*)
        FROM collo_records
        WHERE status = 'ACTIVE'
        GROUP BY 1
        ORDER BY 1
    """)
    print("\n--- Distribusi Tahun Mulai Kontrak (start_date) ---")
    for yr, cnt in c.fetchall():
        print(f"  Tahun {yr}: {cnt} sirkuit")
        
    # 3. Year distribution by end_date (jatuh tempo)
    c.execute("""
        SELECT 
            CASE 
                WHEN end_date IS NULL OR TRIM(end_date) = '' THEN 'Tanpa Jatuh Tempo'
                WHEN end_date LIKE '____-__-__%' THEN SUBSTR(end_date, 1, 4)
                ELSE 'Format Lain'
            END as yr,
            COUNT(*)
        FROM collo_records
        WHERE status = 'ACTIVE'
        GROUP BY 1
        ORDER BY 1
    """)
    print("\n--- Distribusi Tahun Jatuh Tempo Kontrak (end_date) ---")
    for yr, cnt in c.fetchall():
        print(f"  Tahun {yr}: {cnt} sirkuit")

analyze_db('network_infrastructure.db')
analyze_db('telecom_portal_backup_before_dedup.db')
analyze_db('telecom_portal.db')
