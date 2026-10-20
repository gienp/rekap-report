import json
import re

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

sitac = d.get('sitac_records', [])

# Master Geocoding Rules hierarchy (ordered from most specific to general)
RULES = [
    # 1. Exact coordinates
    ('TIKOR', None),

    # 2. Famous Specific Landmarks / Datacenters / Industrial Parks
    ('jiexpo', (-6.1485, 106.8450)),
    ('midpoint', (-6.1855, 106.8155)),
    ('grand indonesia', (-6.1950, 106.8215)),
    ('plaza indonesia', (-6.1930, 106.8220)),
    ('mnc vision', (-6.1685, 106.7585)),
    ('green garden', (-6.1685, 106.7585)),
    ('giic', (-6.3685, 107.1724)),
    ('deltamas', (-6.3685, 107.1724)),
    ('mm2100', (-6.2954, 107.0982)),
    ('cikarang barat', (-6.2750, 107.0980)),
    ('cikarang pusat', (-6.3685, 107.1724)),
    ('cikarang timur', (-6.2850, 107.1850)),
    ('cikarang utara', (-6.2650, 107.1550)),
    ('cikarang selatan', (-6.3250, 107.1250)),
    ('lippo cikarang', (-6.3250, 107.1250)),
    ('jababeka', (-6.2850, 107.1450)),
    ('ejip', (-6.3150, 107.1150)),
    ('plasa cibubur', (-6.3755, 106.9250)),
    ('plaza cibubur', (-6.3755, 106.9250)),
    ('cibubur', (-6.3725, 106.9024)),
    ('jatisampurna', (-6.3755, 106.9250)),
    ('smpn 1 ciawi', (-6.6575, 106.8524)),
    ('ciawi', (-6.6575, 106.8524)),
    ('pasir kuda', (-6.5980, 106.7780)),
    ('kalibata city', (-6.2555, 106.8550)),
    ('kalibata', (-6.2555, 106.8550)),
    ('rawa jati', (-6.2555, 106.8550)),
    ('cikupa mas', (-6.2300, 106.5200)),
    ('cikupa', (-6.2300, 106.5200)),
    ('roa malaka', (-6.1385, 106.8105)),
    ('tambora', (-6.1450, 106.8050)),
    ('kemang raya', (-6.2730, 106.8150)),
    ('kemang', (-6.2730, 106.8150)),
    ('mutiara gading timur', (-6.2850, 107.0250)),
    ('mustika jaya', (-6.2850, 107.0250)),
    ('mustikajaya', (-6.2850, 107.0250)),
    ('karangsatria', (-6.2200, 107.0450)),
    ('koperpu', (-6.2200, 107.0450)),
    ('tambun utara', (-6.2200, 107.0450)),
    ('tambun selatan', (-6.2600, 107.0600)),
    ('tambun', (-6.2600, 107.0600)),
    ('telajung', (-6.2850, 107.0850)),
    ('grand mutiara gading', (-6.2850, 107.0850)),
    ('danau indah', (-6.2750, 107.0980)),
    ('halmahera', (-6.2750, 107.0980)),
    ('limo raya', (-6.3685, 106.7720)),
    ('limo', (-6.3685, 106.7720)),
    ('cinere', (-6.3250, 106.7820)),
    ('sawangan', (-6.3950, 106.7800)),
    ('tugu raya', (-6.3580, 106.8550)),
    ('cimanggis', (-6.3580, 106.8550)),
    ('margonda', (-6.3725, 106.8320)),
    ('depok', (-6.4025, 106.7942)),
    ('meruya selatan', (-6.2080, 106.7350)),
    ('meruya sel', (-6.2080, 106.7350)),
    ('meruya', (-6.2080, 106.7350)),
    ('kembangan', (-6.1850, 106.7450)),
    ('kebon jeruk', (-6.1950, 106.7650)),
    ('adityawarman', (-6.2420, 106.8020)),
    ('kebayoran baru', (-6.2420, 106.8020)),
    ('kebayoran lama', (-6.2480, 106.7820)),
    ('pondok pinang', (-6.2850, 106.7750)),
    ('simatupang', (-6.2950, 106.8250)),
    ('tb simatupang', (-6.2950, 106.8250)),
    ('fatmawati', (-6.2750, 106.7950)),
    ('cipete', (-6.2750, 106.7950)),
    ('cilandak', (-6.2950, 106.8050)),
    ('rasuna said', (-6.2280, 106.8310)),
    ('kuningan barat', (-6.2385, 106.8225)),
    ('mampang prapatan', (-6.2450, 106.8250)),
    ('mampang', (-6.2450, 106.8250)),
    ('kuningan', (-6.2280, 106.8310)),
    ('setiabudi', (-6.2110, 106.8280)),
    ('tebet', (-6.2300, 106.8520)),
    ('pancoran', (-6.2480, 106.8450)),
    ('pasar minggu', (-6.2850, 106.8400)),
    ('jagakarsa', (-6.3350, 106.8250)),
    ('pesanggrahan', (-6.2550, 106.7650)),
    ('bintaro', (-6.2850, 106.7150)),
    ('bsd', (-6.3010, 106.6520)),
    ('serpong', (-6.3210, 106.6690)),
    ('alam sutera', (-6.2250, 106.6550)),
    ('ciputat', (-6.3150, 106.7450)),
    ('pamulang', (-6.3450, 106.7350)),
    ('tangerang selatan', (-6.2950, 106.7100)),
    ('karawaci', (-6.2150, 106.6150)),
    ('tangerang', (-6.1783, 106.6319)),
    ('balaraja', (-6.1950, 106.4550)),
    ('pasar kemis', (-6.1750, 106.5450)),
    ('curug', (-6.2650, 106.5650)),
    ('ciledug', (-6.2280, 106.7050)),
    ('cipondoh', (-6.1850, 106.6750)),
    ('batuceper', (-6.1650, 106.6750)),
    ('kalideres', (-6.1550, 106.7050)),
    ('cengkareng', (-6.1450, 106.7280)),
    ('daan mogot', (-6.1580, 106.7350)),
    ('grogol', (-6.1660, 106.7890)),
    ('tomang', (-6.1750, 106.7950)),
    ('slipi', (-6.1950, 106.7980)),
    ('palmerah', (-6.2050, 106.7950)),
    ('senayan', (-6.2200, 106.8020)),
    ('gelora', (-6.2200, 106.8020)),
    ('pintu satu senayan', (-6.2200, 106.8020)),
    ('karet semanggi', (-6.2180, 106.8180)),
    ('semanggi', (-6.2180, 106.8180)),
    ('sudirman', (-6.2150, 106.8220)),
    ('thamrin', (-6.1950, 106.8220)),
    ('tanah abang', (-6.1855, 106.8155)),
    ('kebon sirih', (-6.1837, 106.8290)),
    ('menteng', (-6.1950, 106.8320)),
    ('cokroaminoto', (-6.1980, 106.8300)),
    ('ridwan rais', (-6.1800, 106.8340)),
    ('gambir', (-6.1764, 106.8285)),
    ('medan merdeka', (-6.1764, 106.8285)),
    ('monas', (-6.1754, 106.8272)),
    ('senen', (-6.1850, 106.8450)),
    ('kemayoran', (-6.1550, 106.8520)),
    ('cempaka putih', (-6.1780, 106.8720)),
    ('sawah besar', (-6.1550, 106.8280)),
    ('johar baru', (-6.1850, 106.8580)),
    ('ancol barat', (-6.1188, 106.8086)),
    ('ancol', (-6.1260, 106.8320)),
    ('lodan', (-6.1260, 106.8280)),
    ('pademangan', (-6.1350, 106.8380)),
    ('penjaringan', (-6.1250, 106.7850)),
    ('pluit', (-6.1180, 106.7910)),
    ('pantai indah kapuk', (-6.1120, 106.7450)),
    ('pik', (-6.1120, 106.7450)),
    ('muara karang', (-6.1150, 106.7750)),
    ('sunter', (-6.1420, 106.8710)),
    ('tanjung priok', (-6.1250, 106.8850)),
    ('kelapa gading', (-6.1580, 106.9080)),
    ('pegangsaan dua', (-6.1680, 106.9150)),
    ('cilincing', (-6.1280, 106.9450)),
    ('marunda', (-6.1050, 106.9650)),
    ('cakung', (-6.1880, 106.9510)),
    ('pulo gadung', (-6.1950, 106.9050)),
    ('pulogadung', (-6.1950, 106.9050)),
    ('rawamangun', (-6.1950, 106.8850)),
    ('matraman', (-6.1980, 106.8650)),
    ('jatinegara', (-6.2250, 106.8750)),
    ('duren sawit', (-6.2350, 106.9150)),
    ('buaran', (-6.2200, 106.9180)),
    ('kramat jati', (-6.2650, 106.8680)),
    ('cawang', (-6.2480, 106.8680)),
    ('halim', (-6.2620, 106.8910)),
    ('makasar', (-6.2750, 106.8850)),
    ('pasar rebo', (-6.3150, 106.8650)),
    ('ciracas', (-6.3350, 106.8750)),
    ('cipayung', (-6.3250, 106.9050)),
    ('bekasi barat', (-6.2350, 106.9850)),
    ('bekasi timur', (-6.2550, 107.0150)),
    ('bekasi selatan', (-6.2450, 106.9850)),
    ('bekasi utara', (-6.2150, 107.0050)),
    ('harapan indah', (-6.1830, 106.9820)),
    ('pondok gede', (-6.2850, 106.9150)),
    ('pondokgede', (-6.2850, 106.9150)),
    ('jatiasih', (-6.2950, 106.9650)),
    ('rawalumbu', (-6.2650, 107.0050)),
    ('cibitung', (-6.2650, 107.0850)),
    ('cikarang', (-6.2610, 107.1520)),
    ('bekasi', (-6.2380, 106.9750)),
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
    ('kiic', (-6.3350, 107.2650)),
    ('suryacipta', (-6.3750, 107.3350)),
    ('telukjambe', (-6.3250, 107.2850)),
    ('karawang barat', (-6.3050, 107.2850)),
    ('karawang timur', (-6.3150, 107.3250)),
    ('karawang', (-6.3150, 107.2950)),
    ('cikampek', (-6.4150, 107.4550)),
    ('purwakarta', (-6.5550, 107.4450)),
    ('cilegon', (-6.0175, 106.0538)),
    ('kotasari', (-6.0150, 106.0350)),
    ('krakatau', (-6.0125, 106.0150)),
    ('anyer', (-6.0512, 105.9180)),
    ('merak', (-5.9350, 106.0050)),
    ('serang', (-6.1104, 106.1550)),
    ('pandeglang', (-6.3088, 106.1065)),
    ('lebak', (-6.5350, 106.2300)),
    ('malingping', (-6.7865, 105.9984)),
    ('sukabumi', (-6.9277, 106.9300)),
    ('kudus', (-6.8048, 110.8405)),
    ('kaliwungu', (-6.8048, 110.8405)),
    ('batang', (-6.9150, 109.7350)),
    ('jakarta pusat', (-6.1800, 106.8300)),
    ('jakarta selatan', (-6.2600, 106.8100)),
    ('jakarta barat', (-6.1680, 106.7600)),
    ('jakarta timur', (-6.2250, 106.9000)),
    ('jakarta utara', (-6.1380, 106.8650)),
]

def geocode(term, ptl, update):
    full = f"{term} {ptl} {update}".lower()

    # Exact coords regex
    m = re.search(r'(-?[0-8]\.\d{4,8})[,\s/]+(10[5-8]\.\d{4,8})', full)
    if m:
        try:
            return float(m.group(1)), float(m.group(2)), 'EXACT_COORDS'
        except:
            pass

    for name, coords in RULES:
        if name == 'TIKOR': continue
        pattern = r'\b' + re.escape(name) + r'\b'
        if re.search(pattern, full) or name in full:
            return coords[0], coords[1], f"MATCH_{name.upper()}"

    return -6.1850, 106.8200, "FALLBACK_JAKARTA"

matched = 0
fallbacks = []
type_counts = {}

for s in sitac:
    term = s.get('terminating') or ''
    p = s.get('pelanggan') or ''
    up = s.get('update_pekerjaan') or ''
    lat, lng, match_type = geocode(term, p, up)
    type_counts[match_type] = type_counts.get(match_type, 0) + 1
    if match_type == 'FALLBACK_JAKARTA':
        fallbacks.append((s.get('id'), p, term[:50]))
    else:
        matched += 1

print(f"Total SITAC: {len(sitac)}")
print(f"Matched successfully to specific location: {matched} ({matched/len(sitac)*100:.1f}%)")
print(f"Fallbacks remaining: {len(fallbacks)}")
print("\nTop match types:")
for k, v in sorted(type_counts.items(), key=lambda x: x[1], reverse=True)[:20]:
    print(f"  {k}: {v}")

if fallbacks:
    print("\nSample Fallbacks:")
    for f in fallbacks[:10]:
        print(f"  ID {f[0]}: {f[1][:25]} | {f[2]}")
