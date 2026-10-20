import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Canonical mapping for jenis_sewa
canonical_jenis = {
    'colocation': 'Colocation',
    'cross connect': 'Cross Connect',
    'colocation dan cross connect': 'Colocation dan Cross Connect',
    'interkoneksi': 'Interkoneksi',
    'revenue sharing': 'Revenue Sharing',
    'space tower': 'Space Tower'
}

# Canonical mapping for pengelola variations
canonical_pengelola = {
    'dci indonesia': 'DCI Indonesia',
    'mora telematika indonesia': 'Mora Telematika Indonesia',
    'pt rekajasa akses': 'PT Rekajasa Akses',
    'envision': 'Envision',
    'bit teknologi nusantara': 'BIT Teknologi Nusantara',
    'ekagrata data gemilang': 'Ekagrata Data Gemilang',
    'asosiasi penyelenggara jasa internet indonesia (apjii)': 'Asosiasi Penyelenggara Jasa Internet Indonesia (APJII)',
    'internetwork komunikasi indonesia': 'Internetwork Komunikasi Indonesia',
    'kawasan berikat nusantara': 'Kawasan Berikat Nusantara',
    'plaza adika lestari': 'Plaza Adika Lestari',
    'smartfren telecom tbk': 'Smartfren Telecom Tbk',
    'biznet data center,pt': 'Biznet Data Center,PT',
    'sigma cipta caraka, pt': 'Sigma Cipta Caraka, PT',
    'sigma cipta caraka,pt': 'Sigma Cipta Caraka,PT',
    'teknovatus solusi sejahtera,pt': 'Teknovatus Solusi Sejahtera,PT'
}

# Canonical mapping for metode_kerjasama
canonical_metode = {
    'sewa  bulanan': 'SEWA BULANAN',
    'sewa bulanan': 'SEWA BULANAN',
    'sewa tahunan': 'SEWA TAHUNAN',
    'bagi hasil': 'BAGI HASIL'
}

affected_records = []
for r in data['collo_records']:
    changed = False
    
    # Check jenis_sewa
    cur_j = r.get('jenis_sewa')
    if cur_j:
        norm_j = canonical_jenis.get(cur_j.strip().lower())
        if norm_j and norm_j != cur_j:
            r['jenis_sewa'] = norm_j
            changed = True
            
    # Check pengelola
    cur_p = r.get('pengelola')
    if cur_p:
        norm_p = canonical_pengelola.get(cur_p.strip().lower())
        if norm_p and norm_p != cur_p:
            r['pengelola'] = norm_p
            changed = True
            
    # Check metode_kerjasama
    cur_m = r.get('metode_kerjasama')
    if cur_m:
        norm_m = canonical_metode.get(cur_m.strip().lower())
        if norm_m and norm_m != cur_m:
            r['metode_kerjasama'] = norm_m
            changed = True
            
    if changed:
        affected_records.append(r)

print(f"Total records updated with normalized values: {len(affected_records)}")
