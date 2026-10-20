import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

def test_search(query):
    terms = [t.strip().lower() for t in query.split() if t.strip()]
    conds = []
    params = []
    for term in terms:
        p = f"%{term}%"
        conds.append("""(
            LOWER(COALESCE(pelanggan, '')) LIKE ? OR 
            LOWER(COALESCE(pengelola, '')) LIKE ? OR 
            LOWER(COALESCE(no_so, '')) LIKE ? OR 
            LOWER(COALESCE(sid, '')) LIKE ? OR 
            LOWER(COALESCE(originating, '')) LIKE ? OR 
            LOWER(COALESCE(terminating, '')) LIKE ? OR 
            LOWER(COALESCE(alamat_pengelola, '')) LIKE ? OR 
            LOWER(COALESCE(keterangan, '')) LIKE ?
        )""")
        params.extend([p] * 8)
    where = ' WHERE ' + ' AND '.join(conds) if conds else ''
    c.execute(f'SELECT COUNT(*) FROM collo_records {where}', params)
    count = c.fetchone()[0]
    
    # fetch top 2 sample
    c.execute(f'SELECT pelanggan, originating, terminating, alamat_pengelola FROM collo_records {where} LIMIT 2', params)
    samples = c.fetchall()
    print(f'Query "{query}": {count} results')
    for s in samples:
        print(f'   -> Cust: {s[0][:25]} | Orig: {s[1][:30]} | Term: {s[2][:30]} | Alamat: {s[3][:30]}')

queries = [
    'bandung',
    'surabaya',
    'bogor',
    'depok',
    'tangerang',
    'bekasi',
    'jakarta pusat',
    'jakarta selatan',
    'kemayoran',
    'cilandak',
    'cyber',
    'mangga dua'
]

for q in queries:
    test_search(q)
