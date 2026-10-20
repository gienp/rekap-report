import sqlite3
import json

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

# Check before
c.execute("SELECT COUNT(*) FROM sitac_records WHERE latitude IS NOT NULL")
before_cnt = c.fetchone()[0]

c.execute("SELECT COUNT(*) FROM sitac_records WHERE coord_type IN ('EXACT', 'EXACT_COORDS', 'USER_INPUT')")
exact_cnt = c.fetchone()[0]

print(f"Before: Total with latitude = {before_cnt}, Total exact = {exact_cnt}")

# Set NULL for records without real coordinates in Excel
c.execute("""
    UPDATE sitac_records
    SET latitude = NULL, longitude = NULL, coord_type = NULL
    WHERE coord_type NOT IN ('EXACT', 'EXACT_COORDS', 'USER_INPUT')
""")
affected = c.rowcount
conn.commit()

c.execute("SELECT COUNT(*) FROM sitac_records WHERE latitude IS NOT NULL")
after_cnt = c.fetchone()[0]
print(f"After: Affected rows = {affected}, Total with latitude = {after_cnt}")

conn.close()
