import json
import re

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

records = d.get('sitac_records', [])

discrepancies = []

for idx, r in enumerate(records):
    term = (r.get('terminating') or '').upper()
    lat = r.get('latitude')
    lng = r.get('longitude')
    pa = r.get('no_pa') or f'ROW_{idx+1}'
    pelanggan = r.get('pelanggan') or ''

    # Define region checks
    # 1. BOGOR / CIAWI / CIBINONG / SENTUL / CILEUNGSI / PARUNG / GUNUNG PUTRI
    is_bogor = any(w in term for w in ['BOGOR', 'CIAWI', 'CIBINONG', 'SENTUL', 'CILEUNGSI', 'PARUNG', 'GUNUNG PUTRI', 'BOJONGGEDE', 'GUNUNGSINDUR', 'TAMANSARI', 'LEUWILIANG'])
    if is_bogor and lat > -6.34:
        discrepancies.append((idx+1, pa, 'BOGOR but lat > -6.34', lat, lng, term[:80]))

    # 2. DEPOK / CIMANGGIS / CINERE / SAWANGAN / MARGONDA / LIMO
    is_depok = any(w in term for w in ['DEPOK', 'CIMANGGIS', 'CINERE', 'SAWANGAN', 'MARGONDA', 'LIMO', 'TAPOS', 'BEJI', 'SUKMAJAYA'])
    if is_depok and (lat > -6.33 or lat < -6.45 or lng > 106.92):
        discrepancies.append((idx+1, pa, 'DEPOK out of bounds', lat, lng, term[:80]))

    # 3. BEKASI / CIKARANG / CIBITUNG / TAMBUN / DELTAMAS / MM2100 / JABABEKA / EJIP
    is_bekasi = any(w in term for w in ['BEKASI', 'CIKARANG', 'CIBITUNG', 'TAMBUN', 'DELTAMAS', 'MM2100', 'JABABEKA', 'EJIP', 'TARUMAJAYA', 'BABELAN', 'BANTAR GEBANG'])
    if is_bekasi and lng < 106.95:
        discrepancies.append((idx+1, pa, 'BEKASI but lng < 106.95', lat, lng, term[:80]))

    # 4. TANGERANG / BSD / SERPONG / TANGSEL / ALAM SUTERA / BINTARO / KARAWACI / CIKUPA / BALARAJA
    is_tgr = any(w in term for w in ['TANGERANG', 'BSD', 'SERPONG', 'TANGSEL', 'ALAM SUTERA', 'BINTARO', 'KARAWACI', 'CIKUPA', 'BALARAJA', 'CIPUTAT', 'PAMULANG', 'CURUG'])
    if is_tgr and lng > 106.75:
        discrepancies.append((idx+1, pa, 'TANGERANG but lng > 106.75', lat, lng, term[:80]))

    # 5. KARAWANG / PURWAKARTA
    is_krw = any(w in term for w in ['KARAWANG', 'PURWAKARTA', 'KIIC', 'SURIACIPTA'])
    if is_krw and lng < 107.15:
        discrepancies.append((idx+1, pa, 'KARAWANG but lng < 107.15', lat, lng, term[:80]))

    # 6. SERANG / CILEGON / MERAK / PANDEGLANG / LEBAK / ANYER / LABUAN
    is_banten = any(w in term for w in ['SERANG', 'CILEGON', 'MERAK', 'PANDEGLANG', 'LEBAK', 'ANYER', 'LABUAN', 'KRAKATAU'])
    if is_banten and lng > 106.3:
        discrepancies.append((idx+1, pa, 'BANTEN BARAT but lng > 106.3', lat, lng, term[:80]))

    # 7. JAWA TENGAH / TIMUR (SEMARANG, KUDUS, BATANG, SURABAYA, SOLO, YOGYA)
    is_jateng = any(w in term for w in ['SEMARANG', 'KUDUS', 'BATANG', 'SURABAYA', 'SOLO', 'YOGYA', 'BANDUNG', 'CIREBON'])
    if is_jateng and lng < 107.5:
        discrepancies.append((idx+1, pa, 'JATENG/JABAR TIMUR but lng < 107.5', lat, lng, term[:80]))

print(f"Total potential discrepancies found: {len(discrepancies)}")
for d in discrepancies[:30]:
    print(f"Row {d[0]} [{d[1]}] Issue: {d[2]} | ({d[3]}, {d[4]}) | Term: {d[5]}")
