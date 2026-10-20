import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

records = d['sitac_records']

issues = []

for idx, r in enumerate(records):
    t = r['terminating'].upper()
    lat = r['latitude']
    lng = r['longitude']
    pa = r.get('no_pa') or f"ROW_{idx+1}"
    c_type = r.get('coord_type')
    
    # 1. Check if Bogor/Ciawi/Cibinong/Sentul has Jakarta lat (> -6.34)
    if any(k in t for k in ['BOGOR', 'CIAWI', 'CIBINONG', 'SENTUL', 'CILEUNGSI', 'GUNUNG PUTRI', 'GUNUNG SINDUR', 'PARUNG', 'BOJONGGEDE', 'RUMPIN', 'PASIR KUDA', 'TAMANSARI']):
        # Exception: Kampung Bogor in Tarumajaya Bekasi
        if 'TARUMAJAYA' not in t and lat > -6.34:
            issues.append((idx+1, pa, 'Bogor site in Jakarta', lat, lng, c_type, t))
            
    # 2. Check if Bekasi/Cikarang/Tambun has lng < 106.92
    if any(k in t for k in ['BEKASI', 'CIKARANG', 'CIBITUNG', 'TAMBUN', 'DELTAMAS', 'MM2100', 'JABABEKA', 'EJIP', 'TARUMAJAYA', 'BABELAN', 'BANTAR GEBANG', 'MUSTIKA JAYA', 'KARANGSATRIA', 'KEDUNGWARINGIN']):
        if lng < 106.92 and lat > -6.36:
            # Exception: Pondok Gede border is around 106.90 - 106.92
            if not ('PONDOK GEDE' in t or 'JATIWARINGIN' in t or 'PINANG RANTI' in t):
                issues.append((idx+1, pa, 'Bekasi site west of 106.92', lat, lng, c_type, t))
                
    # 3. Check if Tangerang/BSD/Serpong has lng > 106.75
    if any(k in t for k in ['TANGERANG', 'BSD', 'SERPONG', 'TANGSEL', 'ALAM SUTERA', 'BINTARO', 'KARAWACI', 'CIKUPA', 'BALARAJA', 'CIPUTAT', 'PAMULANG', 'CURUG', 'LEGOK', 'TIGARAKSA', 'PASAR KEMIS']):
        if lng > 106.75:
            issues.append((idx+1, pa, 'Tangerang site east of 106.75', lat, lng, c_type, t))
            
    # 4. Check if Depok/Cimanggis/Cinere/Limo is placed outside Depok (-6.33 to -6.48, 106.74 to 106.92)
    if any(k in t for k in ['DEPOK', 'CIMANGGIS', 'CINERE', 'SAWANGAN', 'MARGONDA', 'LIMO', 'BEJI', 'TAPOS', 'SUKMAJAYA']):
        if lat > -6.32 or lat < -6.50 or lng < 106.72 or lng > 106.92:
            issues.append((idx+1, pa, 'Depok site out of Depok bounds', lat, lng, c_type, t))

    # 5. Check if West/Central Java or Banten sites are in Jakarta
    if any(k in t for k in ['KUDUS', 'BATANG', 'SEMARANG', 'BANDUNG', 'SUKABUMI', 'CILEGON', 'SERANG', 'LABUAN', 'ANYER']):
        if 'MARUNDA' not in t and 'KBN' not in t:
            if lng > 106.4 and lng < 107.4 and lat > -6.5:
                issues.append((idx+1, pa, 'Outer regional site in Jakarta/Bekasi', lat, lng, c_type, t))

print(f"Total potential location issues: {len(issues)}")
for iss in issues:
    print(f"[{iss[0]}] {iss[1]} | Issue: {iss[2]} | Coords: ({iss[3]}, {iss[4]}) | Type: {iss[5]}")
    print(f"     Terminating: {iss[6]}")
    print("-" * 60)
