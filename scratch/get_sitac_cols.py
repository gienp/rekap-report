import psycopg2

conn = psycopg2.connect(host='127.0.0.1', port=5432, user='postgres', database='telecom_portal')
cur = conn.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'sitac_records' ORDER BY ordinal_position")
cols = [r[0] for r in cur.fetchall()]
print("ALL sitac_records columns:", cols)
conn.close()
