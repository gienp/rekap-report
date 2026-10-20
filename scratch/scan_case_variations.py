import json
import re
from collections import defaultdict

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

active = [r for r in data['collo_records'] if r.get('status') == 'ACTIVE']

print(f"Total current active records: {len(active)}")

def clean_company_name(name):
    if not name:
        return ""
    n = name.lower()
    n = re.sub(r'\bpt\.?\b', '', n)
    n = re.sub(r'\bcv\.?\b', '', n)
    n = re.sub(r'\btbk\.?\b', '', n)
    n = re.sub(r'[^a-z0-9]', '', n)
    return n

def extract_so_tokens(so_str):
    if not so_str:
        return []
    # split by hyphen, slash, space, comma
    tokens = re.findall(r'[a-zA-Z0-9]{6,}', so_str.upper())
    return tokens

def clean_location(loc):
    if not loc:
        return ""
    # strip common words and punctuation
    loc = loc.lower()
    loc = re.sub(r'\b(jl|jalan|gedung|gd|lt|lantai|no|nomor|rt|rw|kel|kec|kota|kab|kabupaten|provinsi|indonesia)\b', '', loc)
    loc = re.sub(r'[^a-z0-9]', '', loc)
    return loc[:25]

# Look for pairs (r1, r2) in active records where:
# - same pengelola (normalized)
# - similar customer name (clean_company_name matches or contains)
# - AND either:
#    a) shared SO token of len >= 8 (like A821204000046)
#    b) similar location (clean_location has high overlap)
#    c) same revenue or consecutive dates

potential_dupes = []
n = len(active)

for i in range(n):
    for j in range(i + 1, n):
        r1, r2 = active[i], active[j]
        
        # Must have same pengelola
        peng1 = (r1.get('pengelola') or '').strip().lower()
        peng2 = (r2.get('pengelola') or '').strip().lower()
        if peng1 != peng2:
            continue
            
        pel1 = clean_company_name(r1.get('pelanggan'))
        pel2 = clean_company_name(r2.get('pelanggan'))
        
        # Check customer similarity
        cust_match = (pel1 == pel2) or (len(pel1) > 5 and pel1 in pel2) or (len(pel2) > 5 and pel2 in pel1)
        if not cust_match:
            continue
            
        # Check SO token overlap
        tokens1 = set(extract_so_tokens(r1.get('no_so')))
        tokens2 = set(extract_so_tokens(r2.get('no_so')))
        so_overlap = tokens1.intersection(tokens2)
        
        # Check SID overlap
        sid1 = set(extract_so_tokens(r1.get('sid')))
        sid2 = set(extract_so_tokens(r2.get('sid')))
        sid_overlap = sid1.intersection(sid2)
        
        # Location match
        loc1 = clean_location(r1.get('terminating'))
        loc2 = clean_location(r2.get('terminating'))
        loc_match = (loc1 == loc2 and len(loc1) > 8) or (len(loc1) > 8 and loc1[:15] == loc2[:15])
        
        # Price match
        price_match = (r1.get('rev_sewa_tahun') == r2.get('rev_sewa_tahun')) and (r1.get('rev_sewa_tahun') or 0) > 0
        
        # If shared SO or shared SID or (loc_match and price_match)
        if so_overlap or sid_overlap or (loc_match and (price_match or len(loc1) > 15)):
            reason = []
            if so_overlap: reason.append(f"SO token: {so_overlap}")
            if sid_overlap: reason.append(f"SID token: {sid_overlap}")
            if loc_match: reason.append(f"Loc match: {loc1[:15]}")
            if price_match: reason.append("Same Price")
            
            potential_dupes.append((r1, r2, ", ".join(reason)))

print(f"\nFound {len(potential_dupes)} candidate duplicate pairs:")
for idx, (r1, r2, reason) in enumerate(potential_dupes):
    print(f"\n[{idx+1}] Pengelola: {r1.get('pengelola')} | Reason: {reason}")
    print(f"  R1 (ID {r1['id']}): Pel={r1.get('pelanggan')} | SO={r1.get('no_so')} | Term={r1.get('terminating')[:40]} | Dates={r1.get('start_date')} to {r1.get('end_date')} | Rev={r1.get('rev_sewa_tahun'):,} | PO={r1.get('po_baru')}")
    print(f"  R2 (ID {r2['id']}): Pel={r2.get('pelanggan')} | SO={r2.get('no_so')} | Term={r2.get('terminating')[:40]} | Dates={r2.get('start_date')} to {r2.get('end_date')} | Rev={r2.get('rev_sewa_tahun'):,} | PO={r2.get('po_baru')}")
