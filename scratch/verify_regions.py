import json
import re

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

records = d.get('sitac_records', [])

def get_expected_region(text):
    t = text.upper()
    
    # Explicit coordinates check
    m = re.search(r'(-?[0-8]\.\d{3,})[,\s/]+(10[5-9]\.\d{3,})', t)
    if m:
        return 'EXPLICIT_COORDS', (float(m.group(1)), float(m.group(2)))
        
    # Check specific cities outside Jabodetabek first
    if 'KUDUS' in t or 'KALIWUNGU' in t:
        return 'KUDUS', (-6.8048, 110.8405)
    if 'BATANG' in t and ('KANDEMAN' in t or 'JAWA TENGAH' in t or 'PLTU' in t):
        return 'BATANG', (-6.905, 109.730)
    if 'SEMARANG' in t and 'MARUNDA' not in t and 'KBN' not in t:
        return 'SEMARANG', (-6.9666, 110.4166)
    if 'BANDUNG' in t:
        return 'BANDUNG', (-6.9175, 107.6191)
    if 'SUKABUMI' in t:
        return 'SUKABUMI', (-6.9277, 106.9300)
    if 'PURWAKARTA' in t and 'CILEGON' not in t and 'BEKASI' not in t:
        return 'PURWAKARTA', (-6.555, 107.445)
    if 'KARAWANG' in t or 'KIIC' in t or 'SURIACIPTA' in t or 'PINDO' in t:
        return 'KARAWANG', (-6.315, 107.295)
    if 'LABUAN' in t:
        return 'LABUAN', (-6.3775, 105.829)
    if 'ANYER' in t:
        return 'ANYER', (-6.050, 105.920)
    if 'CILEGON' in t or 'KRAKATAU' in t:
        return 'CILEGON', (-6.0175, 106.0538)
    if 'SERANG' in t or 'PAKUPATAN' in t or 'CIKANDE' in t or 'TAKTAKAN' in t:
        return 'SERANG', (-6.1104, 106.155)
    if 'RANGKASBITUNG' in t or ('LEBAK' in t and 'RUMPIN' not in t and 'SERANG' not in t):
        return 'LEBAK', (-6.355, 106.250)
    
    # Bogor regions
    if any(w in t for w in ['BOGOR', 'CIAWI', 'CIBINONG', 'SENTUL', 'CILEUNGSI', 'GUNUNG PUTRI', 'GUNUNG SINDUR', 'PARUNG', 'BOJONGGEDE', 'RUMPIN', 'PASIR KUDA', 'TAMANSARI']):
        return 'BOGOR', (-6.595, 106.79)
        
    # Depok regions
    if any(w in t for w in ['DEPOK', 'CIMANGGIS', 'CINERE', 'SAWANGAN', 'MARGONDA', 'LIMO', 'BEJI', 'TAPOS', 'SUKMAJAYA']):
        return 'DEPOK', (-6.4025, 106.8180)
        
    # Bekasi regions
    if any(w in t for w in ['BEKASI', 'CIKARANG', 'CIBITUNG', 'TAMBUN', 'DELTAMAS', 'MM2100', 'JABABEKA', 'EJIP', 'TARUMAJAYA', 'BABELAN', 'BANTAR GEBANG', 'MUSTIKA JAYA', 'KARANGSATRIA', 'PONDOK GEDE', 'JATIASIH']):
        return 'BEKASI', (-6.238, 106.975)
        
    # Tangerang regions
    if any(w in t for w in ['TANGERANG', 'BSD', 'SERPONG', 'TANGSEL', 'ALAM SUTERA', 'BINTARO', 'KARAWACI', 'CIKUPA', 'BALARAJA', 'CIPUTAT', 'PAMULANG', 'CURUG', 'LEGOK', 'TIGARAKSA', 'PASAR KEMIS']):
        return 'TANGERANG', (-6.1783, 106.6319)
        
    # Jakarta regions
    if any(w in t for w in ['JAKARTA BARAT', 'JAKBAR', 'CENGKARENG', 'KALIDERES', 'GROGOL', 'KEBON JERUK', 'KEMBANGAN', 'TAMBORA', 'TAMAN SARI']):
        return 'JAKARTA_BARAT', (-6.168, 106.76)
    if any(w in t for w in ['JAKARTA UTARA', 'JAKUT', 'ANCOL', 'PLUIT', 'PENJARINGAN', 'TANJUNG PRIOK', 'KELAPA GADING', 'SUNTER', 'MARUNDA', 'CILINCING', 'PADEMANGAN']):
        return 'JAKARTA_UTARA', (-6.138, 106.865)
    if any(w in t for w in ['JAKARTA TIMUR', 'JAKTIM', 'CAKUNG', 'PULOGADUNG', 'JATINEGARA', 'RAWAMANGUN', 'MATRAMAN', 'DUREN SAWIT', 'KRAMAT JATI', 'PASAR REBO', 'CIRACAS', 'CIPAYUNG']):
        return 'JAKARTA_TIMUR', (-6.225, 106.900)
    if any(w in t for w in ['JAKARTA SELATAN', 'JAKSEL', 'KEMANG', 'FATMAWATI', 'CILANDAK', 'KEBAYORAN', 'PASAR MINGGU', 'TEBET', 'MAMPANG', 'PANCORAN', 'JAGAKARSA', 'PONDOK INDAH', 'SENAYAN', 'KUNINGAN']):
        return 'JAKARTA_SELATAN', (-6.2615, 106.8106)
    if any(w in t for w in ['JAKARTA PUSAT', 'JAKPUS', 'SUDIRMAN', 'THAMRIN', 'GAMBIR', 'MONAS', 'TANAH ABANG', 'MENTENG', 'SENEN', 'CEMPAKA PUTIH', 'JOHAR BARU', 'KEMAYORAN']):
        return 'JAKARTA_PUSAT', (-6.1815, 106.8285)

    return 'OTHER', None

# Evaluate all 451 records
flags = []
for idx, r in enumerate(records):
    exp_reg, exp_coords = get_expected_region(r['terminating'])
    lat = r['latitude']
    lng = r['longitude']
    
    # Check if there is an explicit discrepancy
    is_mismatch = False
    reason = ""
    
    if exp_reg == 'KUDUS' and lng < 110.0:
        is_mismatch = True; reason = f"Should be Kudus (~110.84), got ({lat}, {lng})"
    elif exp_reg == 'CILEGON' and (lng > 106.2 or lat < -6.2):
        is_mismatch = True; reason = f"Should be Cilegon (~106.05), got ({lat}, {lng})"
    elif exp_reg == 'SERANG' and (lng > 106.35 or lat < -6.3):
        is_mismatch = True; reason = f"Should be Serang (~106.15), got ({lat}, {lng})"
    elif exp_reg == 'BOGOR' and lat > -6.33:
        is_mismatch = True; reason = f"Should be Bogor (lat < -6.34), got ({lat}, {lng})"
    elif exp_reg == 'BEKASI' and lng < 106.92 and lat > -6.36:
        is_mismatch = True; reason = f"Should be Bekasi (lng > 106.95), got ({lat}, {lng})"
    elif exp_reg == 'TANGERANG' and lng > 106.75:
        is_mismatch = True; reason = f"Should be Tangerang (lng < 106.72), got ({lat}, {lng})"
    elif exp_reg == 'DEPOK' and (lat > -6.32 or lat < -6.48):
        is_mismatch = True; reason = f"Should be Depok (-6.33 to -6.45), got ({lat}, {lng})"
    elif exp_reg == 'EXPLICIT_COORDS':
        if abs(lat - exp_coords[0]) > 0.05 or abs(lng - exp_coords[1]) > 0.05:
            is_mismatch = True; reason = f"Has explicit coords {exp_coords}, got ({lat}, {lng})"

    if is_mismatch:
        flags.append((idx+1, r['no_pa'], r['pelanggan'], exp_reg, reason, r['terminating']))

print(f"Total flags found: {len(flags)}")
for f in flags:
    print(f"[{f[0]}] {f[1]} | Expected: {f[3]} | Reason: {f[4]}")
    print(f"     Term: {f[5]}")
    print("-" * 60)
