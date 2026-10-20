import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("Tables:", tables)

for t in tables:
    cols = [r[1] for r in c.execute(f"PRAGMA table_info({t})").fetchall()]
    for col in cols:
        try:
            rows = c.execute(f"SELECT DISTINCT {col} FROM {t} WHERE {col} LIKE '%.%' AND ({col} LIKE '%budi%' OR {col} LIKE '%harlan%' OR {col} LIKE '%edi%' OR {col} LIKE '%zulhadi%' OR {col} LIKE '%muhidin%' OR {col} LIKE '%brian%')").fetchall()
            if rows:
                print(f"Table {t}, Col {col}:", [r[0] for r in rows])
        except Exception as e:
            pass
