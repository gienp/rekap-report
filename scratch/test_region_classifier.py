import sqlite3
import re

conn = sqlite3.connect('telecom_portal.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("SELECT id, no_pa, terminating, pelanggan, ptl, update_pekerjaan FROM sitac_records")
records = cur.fetchall()

def classify_region(term, ptl='', text=''):
    t = f"{(term or '')} {(ptl or '')} {(text or '')}".upper()
    
    # Check TANGERANG first (Kota Tangerang, Tangerang Selatan, Kab Tangerang)
    # CRITICAL: Banten & Tangerang must remain completely separate!
    tng_keywords = [
        'TANGERANG', 'TANGSEL', 'CIPUTAT', 'PAMULANG', 'SERPONG', 'BSD', 'KARAWACI', 
        'CIKUPA', 'BALARAJA', 'LEGOK', 'TIGARAKSA', 'CURUG', 'KELAPA DUA', 'PINANG', 
        'CILEDUG', 'KARANG TENGAH', 'BATUCEPER', 'BENDA', 'CIBODAS', 'JATIUWUNG', 
        'NEGLASARI', 'PERIUK', 'PONDOK AREN', 'SETU', 'CIPUTAT TIMUR', '11TNG', 
        '11TGX', '11TGS', '11TGR', 'PUSPITEK', 'PUSPIPTEK', 'ALAM SUTERA', 'GADING SERPONG'
    ]
    if any(k in t for k in tng_keywords):
        return 'TANGERANG'
        
    # Check BANTEN (Excluding Tangerang! Serang, Cilegon, Pandeglang, Lebak, Rangkasbitung, Anyer, Merak, Bojonegara)
    btn_keywords = [
        'BANTEN', 'SERANG', 'CILEGON', 'PANDEGLANG', 'LEBAK', 'RANGKASBITUNG', 
        'ANYER', 'MERAK', 'BOJONEGARA', 'ASAHIMAS', '11SRG', '11CLG', '11PAN', 
        '11LBK', '11LBA', '11CIL', '11SER'
    ]
    if any(k in t for k in btn_keywords):
        return 'BANTEN'
        
    # Check JAKBAR: Jakarta Barat
    jakbar_keywords = [
        'JAKBAR', 'JAKARTA BARAT', '12JKB', 'KALIDERES', 'CENGKARENG', 'GROGOL', 
        'KEBON JERUK', 'KB. JERUK', 'PALMERAH', 'KEMBANGAN', 'TAMBORA', 'TAMAN SARI', 
        'KAPUK', 'PEGADUNGAN', 'MERUYA', 'JOGLO', 'KEDOYA', 'TOMANG', 'SLIPI', 
        'JEMBATAN BESI', 'DAAN MOGOT', 'GLODOK', 'BINUS', 'RAWA BUAYA', 'SEMANAN',
        'JEMB. LIMA', 'JEMBATAN LIMA', 'ANGKE', 'ROXY', 'TAMAN PALEM', 'PURI INDAH'
    ]
    if any(k in t for k in jakbar_keywords):
        return 'JAKBAR'

    # Check JAKPUSEL: Jakarta Pusat dan Jakarta Selatan
    jakpusel_keywords = [
        '12JKP', '12JKS', 'JAKPUSEL', 'JAKARTA PUSAT', 'JAKARTA SELATAN', 'JAKPUS', 'JAKSEL', 
        'MENTENG', 'GAMBIR', 'TANAH ABANG', 'SENEN', 'CEMPAKA PUTIH', 'JOHAR BARU', 
        'KEMAYORAN', 'SAWAH BESAR', 'SUDIRMAN', 'THAMRIN', 'KUNINGAN', 'TEBET', 
        'SETIABUDI', 'MAMPANG', 'PANCORAN', 'PASAR MINGGU', 'CILANDAK', 'KEBAYORAN', 
        'PESANGGRAHAN', 'JAGAKARSA', 'BLOK M', 'FATMAWATI', 'SIMATUPANG', 'PONDOK INDAH', 
        'CINERE', 'PURI CINERE', 'GATOT SUBROTO', 'CENTENNIAL TOWER', 'INTILAND TOWER', 
        'GRAND INDONESIA', 'KALIBATA', 'MEDAN MERDEKA', 'PERMATA HIJAU', 'PETUKANGAN', 
        'KARET', 'RASUNA SAID', 'KUNINGAN', 'SENAYAN', 'SCBD', 'BINTARO SEKTOR',
        'PEJATEN', 'MANGGARAI', 'CASABLANCA', 'KEMANG', 'LEBAK BULUS', 'CIPETE'
    ]
    if any(k in t for k in jakpusel_keywords):
        return 'JAKPUSEL'

    # Check JAKUTIM: Jakarta Utara dan Jakarta Timur
    jakutim_keywords = [
        '12JKU', '12JKT', '01JKT', 'JAKUTIM', 'JAKARTA UTARA', 'JAKARTA TIMUR', 'JAKUT', 'JAKTIM', 
        'PRIOK', 'KOJA', 'KELAPA GADING', 'CILINCING', 'PADEMANGAN', 'PENJARINGAN', 
        'SUNTER', 'ANCOL', 'PLUIT', 'MARUNDA', 'MATRAMAN', 'PULOGADUNG', 'PULO GADUNG', 
        'JATINEGARA', 'DUREN SAWIT', 'KRAMAT JATI', 'MAKASAR', 'PASAR REBO', 'CIRACAS', 
        'CIPAYUNG', 'CAKUNG', 'RAWAMANGUN', 'CIPINANG', 'RAMBUTAN', 'CIBUBUR', 'TMII', 
        'RAWA MALANG', 'CILILITAN', 'KAMPUNG RAMBUTAN', 'PONDOK KOPI', 'KLENDER',
        'PONDOK KELAPA', 'HALIM', 'HALIM PERDANAKUSUMA', 'PULO GEBANG', 'UJUNG MENTENG'
    ]
    if any(k in t for k in jakutim_keywords):
        return 'JAKUTIM'

    # Check BODEBEK: Bogor, Depok, dan Bekasi
    bodebek_keywords = [
        '13BGR', '13DPK', '13BKS', 'BODEBEK', 'BOGOR', 'DEPOK', 'BEKASI', 'KOTA BKS',
        'CIBINONG', 'SENTUL', 'CIAWI', 'BOJONG', 'PARUNG', 'GUNUNG PUTRI', 'CILEUNGSI', 
        'SAWANGAN', 'CIMANGGIS', 'SUKMAJAYA', 'BEJI', 'LIMO', 'TAPOS', 'CILODONG', 
        'CIKARANG', 'TAMBUN', 'CIBITUNG', 'HARAPAN INDAH', 'JATIASIH', 'PONDOK GEDE', 
        'HARAPAN JAYA', 'JATIMAKMUR', 'JATIMULYA', 'GANDUL', 'PLN GANDUL', 'MUSTIKA JAYA',
        'MM2100', 'GIIC', 'DELTAMAS', 'JONGGOL', 'BOJONG SARI', 'BABAKAN MADANG',
        'CITRA INDAH', 'SUMMARECON BEKASI', 'JABABEKA', 'EJIP', 'LIPPO CIKARANG'
    ]
    if any(k in t for k in bodebek_keywords):
        return 'BODEBEK'

    return 'LAINNYA'

counts = {}
unclass = []
for r in records:
    reg = classify_region(r['terminating'], r['ptl'], r['update_pekerjaan'])
    counts[reg] = counts.get(reg, 0) + 1
    if reg == 'LAINNYA':
        unclass.append(r)

print("Distribution:")
for k, v in counts.items():
    print(f"  {k}: {v}")
print(f"Total classified: {len(records) - len(unclass)} / {len(records)}")
print(f"Unclassified count: {len(unclass)}")
if unclass:
    for u in unclass[:15]:
        print(f"  ID {u['id']} | PA: {u['no_pa']} | Term: {u['terminating']}")
