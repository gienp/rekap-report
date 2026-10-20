import json
import re
import sqlite3
import sys

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Comprehensive geocoding database mapping terms to verified GPS coordinates (WGS84)
GEO_RULES = [
    # Explicit coordinates (lat, lng) in text
    ('TIKOR', None),

    # Specific Fallback Resolvers
    ('niaga_hijau', (-6.2850, 106.7750)),
    ('pondok_pinang', (-6.2850, 106.7750)),
    ('ri 1', (-6.1700, 106.8250)),
    ('kediaman', (-6.1700, 106.8250)),
    ('tanjung priuk', (-6.1150, 106.8850)),
    ('jakarta international expo', (-6.1485, 106.8450)),
    ('ruko griya', (-6.3450, 106.7350)),
    ('bp bumn', (-6.1815, 106.8285)),
    ('bumn', (-6.1815, 106.8285)),
    ('apjii', (-6.2385, 106.8225)),
    ('bni building', (-6.2050, 106.8210)),
    ('head office bni', (-6.2050, 106.8210)),

    # --- SPECIFIC LANDMARKS, DATACENTERS, TOWERS & INDUSTRIAL COMPLEXES ---
    # Cikarang, Cibitung, Bekasi
    ('giic', (-6.3685, 107.1724)),
    ('deltamas', (-6.3685, 107.1724)),
    ('ktt datacenter', (-6.3685, 107.1724)),
    ('mm2100', (-6.2954, 107.0982)),
    ('panasonic industrial component', (-6.2954, 107.0982)),
    ('gandamekar', (-6.2954, 107.0982)),
    ('mekarwangi', (-6.2954, 107.0982)),
    ('kuehne', (-6.2954, 107.0982)),
    ('cikarang barat', (-6.2750, 107.0980)),
    ('cikarang pusat', (-6.3685, 107.1724)),
    ('cikarang timur', (-6.2850, 107.1850)),
    ('cikarang utara', (-6.2650, 107.1550)),
    ('cikarang selatan', (-6.3250, 107.1250)),
    ('lippo cikarang', (-6.3250, 107.1250)),
    ('jababeka', (-6.2850, 107.1450)),
    ('ejip', (-6.3150, 107.1150)),
    ('danau indah', (-6.2750, 107.0980)),
    ('halmahera', (-6.2750, 107.0980)),
    ('grand mutiara gading', (-6.2850, 107.0850)),
    ('telajung', (-6.2850, 107.0850)),
    ('cibitung', (-6.2650, 107.0850)),
    ('mutiara gading timur', (-6.2850, 107.0250)),
    ('mustika jaya', (-6.2850, 107.0250)),
    ('mustikajaya', (-6.2850, 107.0250)),
    ('karangsatria', (-6.2200, 107.0450)),
    ('koperpu', (-6.2200, 107.0450)),
    ('tambun utara', (-6.2200, 107.0450)),
    ('tambun selatan', (-6.2600, 107.0600)),
    ('tambun', (-6.2600, 107.0600)),
    ('plasa cibubur', (-6.3755, 106.9250)),
    ('plaza cibubur', (-6.3755, 106.9250)),
    ('cibubur', (-6.3725, 106.9024)),
    ('jatisampurna', (-6.3755, 106.9250)),
    ('jatiasih', (-6.2950, 106.9650)),
    ('jatimekar', (-6.2950, 106.9650)),
    ('rawalumbu', (-6.2650, 107.0050)),
    ('harapan indah', (-6.1830, 106.9820)),
    ('pondok gede', (-6.2850, 106.9150)),
    ('pondokgede', (-6.2850, 106.9150)),
    ('bekasi barat', (-6.2350, 106.9850)),
    ('bekasi timur', (-6.2550, 107.0150)),
    ('bekasi selatan', (-6.2450, 106.9850)),
    ('bekasi utara', (-6.2150, 107.0050)),
    ('cikarang', (-6.2610, 107.1520)),
    ('bekasi', (-6.2380, 106.9750)),

    # Karawang & Purwakarta
    ('kiic', (-6.3350, 107.2650)),
    ('suryacipta', (-6.3750, 107.3350)),
    ('telukjambe', (-6.3250, 107.2850)),
    ('karawang barat', (-6.3050, 107.2850)),
    ('karawang timur', (-6.3150, 107.3250)),
    ('karawang', (-6.3150, 107.2950)),
    ('cikampek', (-6.4150, 107.4550)),
    ('purwakarta', (-6.5550, 107.4450)),

    # Bogor & Puncak
    ('smpn 1 ciawi', (-6.6575, 106.8524)),
    ('ciawi', (-6.6575, 106.8524)),
    ('pasir kuda', (-6.5980, 106.7780)),
    ('cibinong', (-6.4850, 106.8550)),
    ('sentul', (-6.5412, 106.8624)),
    ('citeureup', (-6.4850, 106.8850)),
    ('gunung putri', (-6.4450, 106.9150)),
    ('cileungsi', (-6.3950, 106.9650)),
    ('jonggol', (-6.4428, 107.0392)),
    ('bojonggede', (-6.4950, 106.7950)),
    ('bojong gede', (-6.4950, 106.7950)),
    ('parung', (-6.4250, 106.7350)),
    ('bogor barat', (-6.5850, 106.7650)),
    ('bogor selatan', (-6.6250, 106.8050)),
    ('bogor timur', (-6.6150, 106.8250)),
    ('bogor utara', (-6.5650, 106.8150)),
    ('bogor tengah', (-6.5950, 106.7950)),
    ('tanah sareal', (-6.5650, 106.7850)),
    ('bogor', (-6.5950, 106.7900)),

    # Depok
    ('limo raya', (-6.3685, 106.7720)),
    ('limo', (-6.3685, 106.7720)),
    ('cinere', (-6.3250, 106.7820)),
    ('sawangan', (-6.3950, 106.7800)),
    ('tugu raya', (-6.3580, 106.8550)),
    ('cimanggis', (-6.3580, 106.8550)),
    ('technovillage', (-6.4150, 106.8550)),
    ('margonda', (-6.3725, 106.8320)),
    ('depok', (-6.4025, 106.7942)),

    # Tangerang & Banten
    ('puspiptek', (-6.3550, 106.6700)),
    ('puspitek', (-6.3550, 106.6700)),
    ('foresta business loft', (-6.3020, 106.6450)),
    ('pagedangan', (-6.3020, 106.6450)),
    ('taman tecno', (-6.3350, 106.6750)),
    ('taman tekno', (-6.3350, 106.6750)),
    ('dci rempoa', (-6.3050, 106.7580)),
    ('rempoa', (-6.3050, 106.7580)),
    ('pondok aren', (-6.2750, 106.7050)),
    ('bsd', (-6.3010, 106.6520)),
    ('serpong', (-6.3210, 106.6690)),
    ('alam sutera', (-6.2250, 106.6550)),
    ('bintaro', (-6.2850, 106.7150)),
    ('ciputat', (-6.3150, 106.7450)),
    ('pamulang', (-6.3450, 106.7350)),
    ('tangerang selatan', (-6.2950, 106.7100)),
    ('tangsel', (-6.2950, 106.7100)),
    ('cikupa mas', (-6.2300, 106.5200)),
    ('feprotama', (-6.2300, 106.5200)),
    ('cikupa', (-6.2300, 106.5200)),
    ('bizpoint', (-6.2250, 106.5250)),
    ('balaraja', (-6.1950, 106.4550)),
    ('pasar kemis', (-6.1750, 106.5450)),
    ('curug', (-6.2650, 106.5650)),
    ('diklat pemda', (-6.2650, 106.5650)),
    ('legok', (-6.3050, 106.5750)),
    ('industri manis', (-6.2050, 106.5750)),
    ('tristate', (-6.1850, 106.5850)),
    ('keroncong', (-6.1850, 106.5850)),
    ('cibodas', (-6.2050, 106.6050)),
    ('cikokol', (-6.1850, 106.6340)),
    ('bpjn banten', (-6.1850, 106.6340)),
    ('karawaci', (-6.2150, 106.6150)),
    ('ciledug', (-6.2280, 106.7050)),
    ('cipondoh', (-6.1850, 106.6750)),
    ('batuceper', (-6.1650, 106.6750)),
    ('tanggerang', (-6.1783, 106.6319)),
    ('tangerang', (-6.1783, 106.6319)),
    ('labuan', (-6.3775, 105.8290)),
    ('pandeglang', (-6.3088, 106.1065)),
    ('lebak', (-6.5350, 106.2300)),
    ('malingping', (-6.7865, 105.9984)),
    ('serang', (-6.1104, 106.1550)),
    ('cilegon', (-6.0175, 106.0538)),
    ('kotasari', (-6.0150, 106.0350)),
    ('krakatau', (-6.0125, 106.0150)),
    ('asahimas', (-6.0125, 106.0150)),
    ('anyer', (-6.0512, 105.9180)),
    ('merak', (-5.9350, 106.0050)),

    # Central & Outer Java
    ('kudus', (-6.8048, 110.8405)),
    ('kaliwungu', (-6.8048, 110.8405)),
    ('satyamitra', (-6.9740, 109.9230)),
    ('banyu putih', (-6.9740, 109.9230)),
    ('batang', (-6.9150, 109.7350)),
    ('sukabumi', (-6.9277, 106.9300)),

    # Jakarta Selatan
    ('kemang raya', (-6.2730, 106.8150)),
    ('kemang', (-6.2730, 106.8150)),
    ('pondok indah', (-6.2750, 106.7820)),
    ('niaga hijau', (-6.2750, 106.7820)),
    ('fatmawati', (-6.2750, 106.7950)),
    ('cipete', (-6.2750, 106.7950)),
    ('cilandak', (-6.2950, 106.8050)),
    ('tanjung barat', (-6.3050, 106.8400)),
    ('mahata', (-6.3050, 106.8400)),
    ('kalibata city', (-6.2555, 106.8550)),
    ('kalibata', (-6.2555, 106.8550)),
    ('rawa jati', (-6.2555, 106.8550)),
    ('petukangan', (-6.2350, 106.7550)),
    ('pesanggrahan', (-6.2550, 106.7650)),
    ('adityawarman', (-6.2420, 106.8020)),
    ('recapital', (-6.2420, 106.8020)),
    ('kebayoran baru', (-6.2420, 106.8020)),
    ('pondok pinang', (-6.2850, 106.7750)),
    ('kebayoran lama', (-6.2480, 106.7820)),
    ('simatupang', (-6.2950, 106.8250)),
    ('tb simatupang', (-6.2950, 106.8250)),
    ('rasuna said', (-6.2280, 106.8310)),
    ('kuningan barat', (-6.2385, 106.8225)),
    ('mampang prapatan', (-6.2450, 106.8250)),
    ('mampang', (-6.2450, 106.8250)),
    ('kuningan', (-6.2280, 106.8310)),
    ('setiabudi', (-6.2110, 106.8280)),
    ('centennial tower', (-6.2320, 106.8200)),
    ('jamsostek', (-6.2340, 106.8220)),
    ('gatot subroto', (-6.2350, 106.8250)),
    ('gatot soebroto', (-6.2350, 106.8250)),
    ('wisma lumba', (-6.2350, 106.8250)),
    ('tebet', (-6.2300, 106.8520)),
    ('pancoran', (-6.2480, 106.8450)),
    ('pasar minggu', (-6.2850, 106.8400)),
    ('jagakarsa', (-6.3350, 106.8250)),
    ('jakarta selatan', (-6.2600, 106.8100)),
    ('jaksel', (-6.2600, 106.8100)),

    # Jakarta Barat
    ('roa malaka', (-6.1385, 106.8105)),
    ('tambora', (-6.1450, 106.8050)),
    ('pakojan', (-6.1380, 106.8050)),
    ('glodok', (-6.1420, 106.8180)),
    ('mnc vision', (-6.1685, 106.7585)),
    ('green garden', (-6.1685, 106.7585)),
    ('tanjung duren', (-6.1750, 106.7850)),
    ('lapangan bola', (-6.1920, 106.7680)),
    ('kebun jeruk', (-6.1920, 106.7680)),
    ('kebon jeruk', (-6.1950, 106.7650)),
    ('meruya selatan', (-6.2080, 106.7350)),
    ('meruya sel', (-6.2080, 106.7350)),
    ('meruya', (-6.2080, 106.7350)),
    ('kembangan', (-6.1850, 106.7450)),
    ('permata hijau', (-6.2220, 106.7820)),
    ('slipi', (-6.1950, 106.7980)),
    ('palmerah', (-6.2050, 106.7950)),
    ('tomang', (-6.1750, 106.7950)),
    ('grogol', (-6.1660, 106.7890)),
    ('kalideres', (-6.1550, 106.7050)),
    ('cengkareng', (-6.1450, 106.7280)),
    ('rawa buaya', (-6.1550, 106.7250)),
    ('duri kosambi', (-6.1650, 106.7200)),
    ('daan mogot', (-6.1580, 106.7350)),
    ('jakarta barat', (-6.1680, 106.7600)),
    ('jakbar', (-6.1680, 106.7600)),

    # Jakarta Pusat
    ('jiexpo', (-6.1485, 106.8450)),
    ('kemayoran', (-6.1550, 106.8520)),
    ('cempaka mas', (-6.1620, 106.8770)),
    ('cempaka putih', (-6.1780, 106.8720)),
    ('lapangan banteng', (-6.1700, 106.8350)),
    ('pasar baru', (-6.1650, 106.8320)),
    ('sawah besar', (-6.1550, 106.8280)),
    ('senen', (-6.1850, 106.8450)),
    ('johar baru', (-6.1850, 106.8580)),
    ('midpoint', (-6.1855, 106.8155)),
    ('tanah abang', (-6.1855, 106.8155)),
    ('kebon sirih', (-6.1837, 106.8290)),
    ('kebon melati', (-6.1950, 106.8180)),
    ('menteng', (-6.1950, 106.8320)),
    ('cokroaminoto', (-6.1980, 106.8300)),
    ('ridwan rais', (-6.1800, 106.8340)),
    ('medan merdeka barat', (-6.1764, 106.8222)),
    ('medan merdeka sel', (-6.1815, 106.8285)),
    ('medan merdeka timur', (-6.1770, 106.8320)),
    ('medan merdeka utara', (-6.1700, 106.8250)),
    ('medan merdeka', (-6.1764, 106.8285)),
    ('istana merdeka', (-6.1700, 106.8250)),
    ('gambir', (-6.1764, 106.8285)),
    ('monas', (-6.1754, 106.8272)),
    ('grand indonesia', (-6.1950, 106.8215)),
    ('plaza indonesia', (-6.1930, 106.8220)),
    ('thamrin', (-6.1950, 106.8220)),
    ('intiland', (-6.2085, 106.8205)),
    ('wisma 46', (-6.2050, 106.8210)),
    ('wtc 2', (-6.2150, 106.8220)),
    ('wtc', (-6.2150, 106.8220)),
    ('danantara', (-6.2180, 106.8180)),
    ('sudirman', (-6.2150, 106.8220)),
    ('karet semanggi', (-6.2180, 106.8180)),
    ('semanggi', (-6.2180, 106.8180)),
    ('karet', (-6.2050, 106.8180)),
    ('jcc', (-6.2185, 106.8020)),
    ('gbk', (-6.2185, 106.8020)),
    ('gelora bung karno', (-6.2185, 106.8020)),
    ('senayan', (-6.2200, 106.8020)),
    ('gelora', (-6.2200, 106.8020)),
    ('pintu satu senayan', (-6.2200, 106.8020)),
    ('jakarta pusat', (-6.1800, 106.8300)),
    ('jakpus', (-6.1800, 106.8300)),

    # Jakarta Utara
    ('brin ancol', (-6.1260, 106.8280)),
    ('lodan', (-6.1260, 106.8280)),
    ('ancol barat', (-6.1188, 106.8086)),
    ('ancol', (-6.1260, 106.8320)),
    ('pademangan', (-6.1350, 106.8380)),
    ('penjaringan', (-6.1250, 106.7850)),
    ('pluit', (-6.1180, 106.7910)),
    ('pantai indah kapuk', (-6.1120, 106.7450)),
    ('pik', (-6.1120, 106.7450)),
    ('muara karang', (-6.1150, 106.7750)),
    ('sunter', (-6.1420, 106.8710)),
    ('stasiun tanjung priuk', (-6.1150, 106.8850)),
    ('tanjung priok', (-6.1250, 106.8850)),
    ('tj. priok', (-6.1250, 106.8850)),
    ('sungai bambu', (-6.1250, 106.8850)),
    ('semper', (-6.1280, 106.9150)),
    ('kramat tugu', (-6.1280, 106.9150)),
    ('islamic centre', (-6.1280, 106.9150)),
    ('koja', (-6.1280, 106.9150)),
    ('kelapa gading', (-6.1580, 106.9080)),
    ('pegangsaan dua', (-6.1680, 106.9150)),
    ('rawa malang', (-6.1150, 106.9450)),
    ('cilincing', (-6.1280, 106.9450)),
    ('marunda', (-6.1050, 106.9650)),
    ('jakarta utara', (-6.1380, 106.8650)),
    ('jakut', (-6.1380, 106.8650)),

    # Jakarta Timur
    ('jiep', (-6.1950, 106.9150)),
    ('pulo gadung', (-6.1950, 106.9050)),
    ('pulogadung', (-6.1950, 106.9050)),
    ('cakung', (-6.1880, 106.9510)),
    ('rawamangun', (-6.1950, 106.8850)),
    ('matraman', (-6.1980, 106.8650)),
    ('jatinegara', (-6.2250, 106.8750)),
    ('indomobil', (-6.2420, 106.8680)),
    ('duren sawit', (-6.2350, 106.9150)),
    ('buaran', (-6.2200, 106.9180)),
    ('kramat jati', (-6.2650, 106.8680)),
    ('cawang', (-6.2480, 106.8680)),
    ('halim', (-6.2620, 106.8910)),
    ('makasar', (-6.2750, 106.8850)),
    ('pasar rebo', (-6.3150, 106.8650)),
    ('ciracas', (-6.3350, 106.8750)),
    ('tmii', (-6.3025, 106.8950)),
    ('cipayung', (-6.3250, 106.9050)),
    ('jakarta timur', (-6.2250, 106.9000)),
    ('jaktim', (-6.2250, 106.9000)),
]

def geocode_record(term, pelanggan, update, no_pa):
    full = f"{term} {pelanggan} {update} {no_pa}".lower()

    # 1. Regex Exact Coordinates
    m = re.search(r'(-?[0-8]\.\d{4,8})[,\s/]+(10[5-8]\.\d{4,8})', full)
    if m:
        try:
            return float(m.group(1)), float(m.group(2)), 'EXACT_COORDS'
        except:
            pass

    # 2. Sequential Exact Match against GEO_RULES
    for name, coords in GEO_RULES:
        if name == 'TIKOR': continue
        pattern = r'\b' + re.escape(name) + r'\b'
        if re.search(pattern, full) or name in full:
            return coords[0], coords[1], f"GEO_{name.upper().replace(' ', '_')}"

    return -6.1850, 106.8200, "DEFAULT_JAKARTA"

def run_update():
    print("=== UPDATING ALL DATASETS WITH ACCURATE GEOCODING ===")

    # 1. Load sitac_collo_data.json
    with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
        master_data = json.load(f)

    sitac_list = master_data.get('sitac_records', [])
    updated = 0
    type_counts = {}

    for s in sitac_list:
        term = s.get('terminating') or ''
        pel = s.get('pelanggan') or ''
        up = s.get('update_pekerjaan') or ''
        pa = s.get('no_pa') or ''

        lat, lng, match_type = geocode_record(term, pel, up, pa)
        s['latitude'] = lat
        s['longitude'] = lng
        s['coord_type'] = match_type
        type_counts[match_type] = type_counts.get(match_type, 0) + 1
        updated += 1

    print(f"✓ Geocoded {updated} SITAC records successfully.")
    print("Top matched geocoding areas:")
    for k, v in sorted(type_counts.items(), key=lambda x: x[1], reverse=True)[:15]:
        print(f"  {k}: {v}")

    # 2. Save sitac_collo_data.json
    with open('sitac_collo_data.json', 'w', encoding='utf-8') as f:
        json.dump(master_data, f, indent=2, ensure_ascii=False)
    print("✓ Saved sitac_collo_data.json")

    # 3. Save sitac_collo_data.js (window.SITAC_COLLO_DATA)
    js_content = f"window.SITAC_COLLO_DATA = {json.dumps(master_data, indent=2, ensure_ascii=False)};\n"
    with open('sitac_collo_data.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
    print("✓ Saved sitac_collo_data.js")

    # 4. Save to SQLite database telecom_portal.db
    conn = sqlite3.connect('telecom_portal.db')
    cursor = conn.cursor()
    for s in sitac_list:
        cursor.execute("""
            UPDATE sitac_records
            SET latitude = ?, longitude = ?, coord_type = ?
            WHERE id = ?
        """, (s['latitude'], s['longitude'], s['coord_type'], s['id']))
    conn.commit()
    conn.close()
    print("✓ Saved coordinates to telecom_portal.db")

    fallbacks = [s for s in sitac_list if s.get('coord_type') == 'DEFAULT_JAKARTA']
    if fallbacks:
        print(f"Remaining {len(fallbacks)} fallbacks:")
        for f in fallbacks:
            print(f"  ID {f['id']}: {f.get('pelanggan', '')[:25]} | {f.get('terminating', '')}")

if __name__ == '__main__':
    run_update()
