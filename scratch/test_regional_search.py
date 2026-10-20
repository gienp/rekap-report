import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

test_queries = ['bandung', 'surabaya', 'bogor', 'depok', 'tangerang', 'kemayoran', 'cilandak', 'jakarta pusat', 'cyber 2']

for q in test_queries:
    words = [w.strip() for w in q.split() if w.strip()]
    conds = []
    params = []
    for w in words:
        p = f"%{w}%"
        conds.append("(LOWER(pelanggan) LIKE ? OR LOWER(pengelola) LIKE ? OR LOWER(no_so) LIKE ? OR LOWER(sid) LIKE ? OR LOWER(terminating) LIKE ? OR LOWER(originating) LIKE ? OR LOWER(alamat_pengelola) LIKE ? OR LOWER(keterangan) LIKE ?)")
        params.extend([p] * 8)
    clause = " AND ".join(conds)
    c.execute(f"SELECT COUNT(*) FROM collo_records WHERE {clause}", params)
    cnt = c.fetchone()[0]
    print(f"Query '{q}': {cnt} results")
