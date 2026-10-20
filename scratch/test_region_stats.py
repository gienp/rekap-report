import sqlite3

conn = sqlite3.connect('telecom_portal.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT id, no_pa, terminating, ptl, update_pekerjaan, biaya_permintaan_awal, biaya_final, efisiensi_rupiah, efisiensi_persen, is_berbiaya, progress FROM sitac_records")
records = cur.fetchall()

def classify_region(row):
    t = f"{(row['terminating'] or '')} {(row['ptl'] or '')} {(row['update_pekerjaan'] or '')}".upper()
    
    # 1. Tangerang (Must be checked before Banten!)
    tng = [
        'TANGERANG', 'TANGSEL', 'CIPUTAT', 'PAMULANG', 'SERPONG', 'BSD', 'KARAWACI', 
        'CIKUPA', 'BALARAJA', 'LEGOK', 'TIGARAKSA', 'CURUG', 'KELAPA DUA', 'PINANG', 
        'CILEDUG', 'KARANG TENGAH', 'BATUCEPER', 'BENDA', 'CIBODAS', 'JATIUWUNG', 
        'NEGLASARI', 'PERIUK', 'PONDOK AREN', 'SETU', 'CIPUTAT TIMUR', '11TNG', 
        '11TGX', '11TGS', '11TGR', 'PUSPITEK', 'PUSPIPTEK', 'ALAM SUTERA', 'GADING SERPONG', 'CIKOKOL'
    ]
    if any(k in t for k in tng):
        return 'TANGERANG'

    # 2. Banten (Serang, Cilegon, Pandeglang, Lebak - strictly excluding Tangerang)
    btn = [
        'BANTEN', 'SERANG', 'CILEGON', 'PANDEGLANG', 'LEBAK', 'RANGKASBITUNG', 
        'ANYER', 'MERAK', 'BOJONEGARA', 'ASAHIMAS', 'KRAKATAU STEEL', '11SRG', 
        '11CLG', '11PAN', '11LBK', '11LBA', '11CIL', '11SER'
    ]
    if any(k in t for k in btn):
        return 'BANTEN'

    # 3. Jakbar (Jakarta Barat)
    jkb = [
        'JAKBAR', 'JAKARTA BARAT', '12JKB', 'KALIDERES', 'CENGKARENG', 'GROGOL', 
        'KEBON JERUK', 'KB. JERUK', 'PALMERAH', 'KEMBANGAN', 'TAMBORA', 'TAMAN SARI', 
        'KAPUK', 'PEGADUNGAN', 'MERUYA', 'JOGLO', 'KEDOYA', 'TOMANG', 'SLIPI', 
        'JEMBATAN BESI', 'DAAN MOGOT', 'GLODOK', 'BINUS', 'RAWA BUAYA', 'SEMANAN',
        'JEMB. LIMA', 'JEMBATAN LIMA', 'ANGKE', 'ROXY', 'TAMAN PALEM', 'PURI INDAH'
    ]
    if any(k in t for k in jkb):
        return 'JAKBAR'

    # 4. Jakpusel (Jakarta Pusat & Jakarta Selatan)
    jps = [
        '12JKP', '12JKS', 'JAKPUSEL', 'JAKARTA PUSAT', 'JAKARTA SELATAN', 'JAKPUS', 'JAKSEL', 
        'MENTENG', 'GAMBIR', 'TANAH ABANG', 'SENEN', 'CEMPAKA PUTIH', 'JOHAR BARU', 
        'KEMAYORAN', 'SAWAH BESAR', 'SUDIRMAN', 'THAMRIN', 'KUNINGAN', 'TEBET', 
        'SETIABUDI', 'MAMPANG', 'PANCORAN', 'PASAR MINGGU', 'CILANDAK', 'KEBAYORAN', 
        'PESANGGRAHAN', 'JAGAKARSA', 'BLOK M', 'FATMAWATI', 'SIMATUPANG', 'PONDOK INDAH', 
        'CINERE', 'PURI CINERE', 'GATOT SUBROTO', 'CENTENNIAL TOWER', 'INTILAND TOWER', 
        'GRAND INDONESIA', 'KALIBATA', 'MEDAN MERDEKA', 'PERMATA HIJAU', 'PETUKANGAN', 
        'KARET', 'RASUNA SAID', 'SENAYAN', 'SCBD', 'BINTARO SEKTOR', 'PEJATEN', 'MANGGARAI', 
        'CASABLANCA', 'KEMANG', 'LEBAK BULUS', 'CIPETE', 'TANJUNG BARAT', 'JCC', 
        'M.T HARYONO', 'CAWANG', 'JAMSOSTEK', 'CEMPAKA MAS'
    ]
    if any(k in t for k in jps):
        return 'JAKPUSEL'

    # 5. Jakutim (Jakarta Utara & Jakarta Timur)
    jut = [
        '12JKU', '12JKT', '01JKT', 'JAKUTIM', 'JAKARTA UTARA', 'JAKARTA TIMUR', 'JAKUT', 'JAKTIM', 
        'PRIOK', 'KOJA', 'KELAPA GADING', 'CILINCING', 'PADEMANGAN', 'PENJARINGAN', 
        'SUNTER', 'ANCOL', 'PLUIT', 'MARUNDA', 'MATRAMAN', 'PULOGADUNG', 'PULO GADUNG', 
        'JATINEGARA', 'DUREN SAWIT', 'KRAMAT JATI', 'MAKASAR', 'PASAR REBO', 'CIRACAS', 
        'CIPAYUNG', 'CAKUNG', 'RAWAMANGUN', 'CIPINANG', 'RAMBUTAN', 'CIBUBUR', 'TMII', 
        'RAWA MALANG', 'CILILITAN', 'KAMPUNG RAMBUTAN', 'PONDOK KOPI', 'KLENDER', 
        'PONDOK KELAPA', 'HALIM', 'PULO GEBANG', 'UJUNG MENTENG', 'SEMPER', 'PEGANGSAAN', 
        'TANJUNG PRIUK'
    ]
    if any(k in t for k in jut):
        return 'JAKUTIM'

    # 6. Bodebek (Bogor, Depok, Bekasi)
    bdb = [
        '13BGR', '13DPK', '13BKS', 'BODEBEK', 'BOGOR', 'DEPOK', 'BEKASI', 'KOTA BKS',
        'CIBINONG', 'SENTUL', 'CIAWI', 'BOJONG', 'PARUNG', 'GUNUNG PUTRI', 'CILEUNGSI', 
        'SAWANGAN', 'CIMANGGIS', 'SUKMAJAYA', 'BEJI', 'LIMO', 'TAPOS', 'CILODONG', 
        'CIKARANG', 'TAMBUN', 'CIBITUNG', 'HARAPAN INDAH', 'JATIASIH', 'PONDOK GEDE', 
        'HARAPAN JAYA', 'JATIMAKMUR', 'JATIMULYA', 'GANDUL', 'PLN GANDUL', 'MUSTIKA JAYA', 
        'MM2100', 'GIIC', 'DELTAMAS', 'JONGGOL', 'BOJONG SARI', 'BABAKAN MADANG', 
        'CITRA INDAH', 'SUMMARECON BEKASI', 'JABABEKA', 'EJIP', 'LIPPO CIKARANG', 'KARAWANG'
    ]
    if any(k in t for k in bdb):
        return 'BODEBEK'

    return 'LAINNYA'

regions = ['JAKPUSEL', 'JAKUTIM', 'BODEBEK', 'JAKBAR', 'BANTEN', 'TANGERANG', 'LAINNYA']
stats = {r: {'count': 0, 'berbiaya': 0, 'zerocost': 0, 'awal': 0, 'final': 0, 'hemat': 0} for r in regions}

for r in records:
    reg = classify_region(r)
    st = stats[reg]
    st['count'] += 1
    awal = float(r['biaya_permintaan_awal'] or 0)
    final = float(r['biaya_final'] or 0)
    hemat = float(r['efisiensi_rupiah'] or 0)
    
    if r['is_berbiaya'] == 1 or final > 0 or awal > 0:
        st['berbiaya'] += 1
    else:
        st['zerocost'] += 1
        
    st['awal'] += awal
    st['final'] += final
    st['hemat'] += hemat

print(f"{'WILAYAH':<12} | {'TOTAL':<6} | {'BERBIAYA':<8} | {'ZERO':<6} | {'BIAYA AWAL':<18} | {'BIAYA FINAL':<18} | {'HEMAT (RP)':<18} | {'EFISIENSI %'}")
print("-" * 115)
tot_count = tot_awal = tot_final = tot_hemat = 0
for reg in ['JAKPUSEL', 'JAKUTIM', 'BODEBEK', 'JAKBAR', 'BANTEN', 'TANGERANG']:
    s = stats[reg]
    pct = (s['hemat'] / s['awal'] * 100) if s['awal'] > 0 else 0
    print(f"{reg:<12} | {s['count']:<6} | {s['berbiaya']:<8} | {s['zerocost']:<6} | Rp {s['awal']:>14,.0f} | Rp {s['final']:>14,.0f} | Rp {s['hemat']:>14,.0f} | {pct:>6.2f}%")
    tot_count += s['count']
    tot_awal += s['awal']
    tot_final += s['final']
    tot_hemat += s['hemat']

tot_pct = (tot_hemat / tot_awal * 100) if tot_awal > 0 else 0
print("-" * 115)
print(f"{'SUBTOTAL 6':<12} | {tot_count:<6} | {'-':<8} | {'-':<6} | Rp {tot_awal:>14,.0f} | Rp {tot_final:>14,.0f} | Rp {tot_hemat:>14,.0f} | {tot_pct:>6.2f}%")
