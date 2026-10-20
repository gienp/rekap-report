import json
import re

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

active = [r for r in data['collo_records'] if r.get('status') == 'ACTIVE']

def norm_str(s):
    if not s:
        return ''
    s = s.upper()
    s = re.sub(r'\bPT\.?\b', '', s)
    s = re.sub(r'\bCV\.?\b', '', s)
    s = re.sub(r'\bTBK\.?\b', '', s)
    s = re.sub(r'[^A-Z0-9]', '', s)
    return s

def norm_so(s):
    if not s:
        return set()
    return set(re.findall(r'[A-Z0-9]{6,}', s.upper()))

case_diff_pairs = []

for i in range(len(active)):
    for j in range(i+1, len(active)):
        r1, r2 = active[i], active[j]
        p1 = (r1.get('pengelola') or '').strip().upper()
        p2 = (r2.get('pengelola') or '').strip().upper()
        if p1 != p2:
            continue
            
        pel1_raw = (r1.get('pelanggan') or '').strip()
        pel2_raw = (r2.get('pelanggan') or '').strip()
        
        pel1_norm = norm_str(pel1_raw)
        pel2_norm = norm_str(pel2_raw)
        
        if not pel1_norm or not pel2_norm:
            continue
            
        pel_match = (pel1_norm == pel2_norm) or (len(pel1_norm) > 6 and pel1_norm in pel2_norm) or (len(pel2_norm) > 6 and pel2_norm in pel1_norm)
        if not pel_match:
            continue
            
        term1_raw = (r1.get('terminating') or '').strip()
        term2_raw = (r2.get('terminating') or '').strip()
        
        term1_norm = norm_str(term1_raw)
        term2_norm = norm_str(term2_raw)
        
        term_match = (term1_norm == term2_norm) or (len(term1_norm) > 10 and term1_norm[:15] == term2_norm[:15]) or (len(term1_norm) > 10 and (term1_norm in term2_norm or term2_norm in term1_norm))
        
        so1 = norm_so(r1.get('no_so'))
        so2 = norm_so(r2.get('no_so'))
        so_overlap = so1.intersection(so2)
        
        sid1 = norm_so(r1.get('sid'))
        sid2 = norm_so(r2.get('sid'))
        sid_overlap = sid1.intersection(sid2)
        
        price1 = r1.get('rev_sewa_tahun') or 0
        price2 = r2.get('rev_sewa_tahun') or 0
        same_price = (price1 == price2 and price1 > 0)
        
        # Check if difference is due to letter casing or formatting
        has_letter_diff = (pel1_raw != pel2_raw) or (term1_raw != term2_raw)
        
        if has_letter_diff and ((term_match and (same_price or so_overlap or sid_overlap)) or (so_overlap and term_match) or (sid_overlap and term_match)):
            case_diff_pairs.append({
                'r1': r1,
                'r2': r2,
                'so_ov': list(so_overlap),
                'sid_ov': list(sid_overlap),
                'same_price': same_price,
                'pel_match': pel_match,
                'term_match': term_match
            })

print(f"Total matching pairs where letter/formatting differed: {len(case_diff_pairs)}")
for item in case_diff_pairs:
    r1, r2 = item['r1'], item['r2']
    t1 = r1.get('terminating') or ''
    t2 = r2.get('terminating') or ''
    print(f"\n[ID {r1['id']} vs ID {r2['id']}] Peng: {r1.get('pengelola')} | SamePrice: {item['same_price']} | SO_ov: {item['so_ov']} | SID_ov: {item['sid_ov']}")
    print(f"  R1: Pel='{r1.get('pelanggan')}' | SO='{r1.get('no_so')}' | Term='{t1[:35]}' | Dates={r1.get('start_date')} to {r1.get('end_date')} | Rev={r1.get('rev_sewa_tahun'):,}")
    print(f"  R2: Pel='{r2.get('pelanggan')}' | SO='{r2.get('no_so')}' | Term='{t2[:35]}' | Dates={r2.get('start_date')} to {r2.get('end_date')} | Rev={r2.get('rev_sewa_tahun'):,}")
