import sqlite3
from collections import Counter

conn = sqlite3.connect('telecom_portal.db')
cursor = conn.cursor()
cursor.execute("SELECT tahun, COUNT(*) FROM sitac_records GROUP BY tahun")
print("Existing tahun breakdown in sitac_records:")
for row in cursor.fetchall():
    print(f"  Tahun: {row[0]} -> {row[1]} rows")

cursor.execute("SELECT excel_no, no_pa, pelanggan, pic_perijinan, date_dispos, tahun, progress FROM sitac_records LIMIT 5")
print("\nSample existing rows in sitac_records:")
for row in cursor.fetchall():
    print(" ", row)

cursor.execute("SELECT COUNT(DISTINCT no_pa) FROM sitac_records")
print(f"\nDistinct no_pa count: {cursor.fetchone()[0]}")
