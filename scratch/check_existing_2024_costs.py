import sqlite3
import json

# Check existing 2 rows in DB for 2024
conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute("SELECT biaya_permintaan_awal, biaya_final, efisiensi_rupiah, is_berbiaya FROM sitac_records WHERE tahun = 2024")
existing_2024 = c.fetchall()
print("Existing 2024 in DB:", existing_2024)

# We can calculate the combined 2024 summary
