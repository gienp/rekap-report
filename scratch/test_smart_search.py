import sqlite3
import re

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

def parse_collo_search(query):
    # Check for prefix or intent words
    q = query.strip()
    orig_only = False
    term_only = False
    
    # Check if user typed orig: or terminating:
    if re.search(r'\b(orig|originating)\s*:\s*', q, re.IGNORECASE):
        # Specific prefix
        clean_q = re.sub(r'\b(orig|originating)\s*:\s*', '', q, flags=re.IGNORECASE).strip()
        return [("orig", clean_q)]
    elif re.search(r'\b(term|terminating)\s*:\s*', q, re.IGNORECASE):
        clean_q = re.sub(r'\b(term|terminating)\s*:\s*', '', q, flags=re.IGNORECASE).strip()
        return [("term", clean_q)]
    
    # Check if query starts with "originating " or "terminating "
    orig_match = re.match(r'^(originating|orig)\s+(.+)$', q, re.IGNORECASE)
    if orig_match:
        return [("orig", orig_match.group(2).strip())]
        
    term_match = re.match(r'^(terminating|term)\s+(.+)$', q, re.IGNORECASE)
    if term_match:
        return [("term", term_match.group(2).strip())]

    # Otherwise general search with tokens
    tokens = [w.strip().lower() for w in q.split() if w.strip()]
    return [("general", t) for t in tokens]

def build_search_conditions(search_query):
    parsed = parse_collo_search(search_query)
    conds = []
    params = []
    
    for kind, val in parsed:
        if kind == "orig":
            tokens = [t.lower() for t in val.split() if t]
            for t in tokens:
                conds.append("LOWER(COALESCE(originating, '')) LIKE ?")
                params.append(f"%{t}%")
        elif kind == "term":
            tokens = [t.lower() for t in val.split() if t]
            for t in tokens:
                conds.append("LOWER(COALESCE(terminating, '')) LIKE ?")
                params.append(f"%{t}%")
        else: # general
            term = val
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
            
    return conds, params

test_queries = [
    'bandung',
    'originating bandung',
    'orig: bandung',
    'terminating bogor',
    'term: bogor',
    'bogor',
    'surabaya',
    'jakarta pusat',
    'cyber 2',
    'kemayoran'
]

for tq in test_queries:
    conds, params = build_search_conditions(tq)
    where = " WHERE " + " AND ".join(conds) if conds else ""
    c.execute(f"SELECT COUNT(*) FROM collo_records {where}", params)
    cnt = c.fetchone()[0]
    print(f"Query '{tq}' -> {cnt} matches")
    c.execute(f"SELECT pelanggan, originating, terminating FROM collo_records {where} LIMIT 1", params)
    row = c.fetchone()
    if row:
        print(f"   Sample: Cust={row[0][:20]} | Orig={row[1][:25]} | Term={row[2][:25]}")
