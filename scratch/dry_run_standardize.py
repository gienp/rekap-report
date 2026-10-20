import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute("SELECT id, pengelola FROM collo_records")
records = c.fetchall()

def canonical_pengelola_extended(s):
    if not s:
        return ''
    raw = str(s).strip()
    u = raw.upper()

    # Caturmas Kelola Sukses (Fix Caltumas typo & all-caps)
    if 'CATURMAS' in u or 'CALTUMAS' in u:
        return 'Caturmas Kelola Sukses'

    # Indointernet
    if 'INDOINTERNET' in u or 'INDO INTERNET' in u:
        return 'Indointernet'

    # Infrastruktur Cakrawala Telekomunikasi (Fix Infranstruktur typo)
    if 'CAKRAWALA TELEKOMUNIKASI' in u:
        return 'Infrastruktur Cakrawala Telekomunikasi'

    # IDC
    if 'INTERNETINDO DATA CENTRA' in u or ('IDC' in u and 'INTERNETINDO' in u):
        return 'IDC (Internetindo Data Centra Indonesia)'

    # Crisis Center Menara Permai (Fix Cricis typo)
    if 'MENARA PERMAI' in u:
        return 'Crisis Center Menara Permai'

    # Data Sinergitama Jaya (Elitery)
    if 'DATA SINERGITAMA' in u or 'ELITERY' in u:
        return 'Data Sinergitama Jaya (Elitery)'

    # PLN Dist Jaya AP Bulungan
    if 'PLN DIST' in u and 'BULUNGAN' in u:
        return 'PLN Dist Jaya AP Bulungan'

    # Graha Anugerah Sejahtera
    if 'GRAHA ANUGERAH' in u:
        return 'Graha Anugerah Sejahtera'

    # Intershop Prima Center
    if 'INTERSHOP PRIMA' in u:
        return 'Intershop Prima Center'

    # Prestasi Piranti Informasi
    if 'PRESTASI PIRANTI' in u:
        return 'Prestasi Piranti Informasi'

    # Megalopolis Manunggal Industrial Development
    if 'MEGALOPOLIS MANUNGGAL' in u:
        return 'Megalopolis Manunggal Industrial Development'

    # Mandiri Andal Sejahtera
    if 'MANDIRI ANDAL' in u or 'MAKMUR JAYA SERASI' in u:
        return 'Mandiri Andal Sejahtera'

    # PCDC Propco One
    if 'PROPCO ONE' in u:
        return 'PCDC Propco One'

    # Trans Indonesia Superkoridor
    if 'SUEPRKORIDOR' in u or 'SUPERKORIDOR' in u:
        return 'Trans Indonesia Superkoridor'

    # Wisma Keiai Indonesia
    if 'WISMA KEIAI' in u:
        return 'Wisma Keiai Indonesia'

    # BPJS Ketenagakerjaan
    if 'BPJS KETENAGAKERJAAN' in u and 'BINAJASA' not in u:
        return 'BPJS Ketenagakerjaan'

    # APJII
    if u == 'APJII' or u == 'ASOSIASI PENYELENGGARA JASA INTERNET INDONESIA (APJII)':
        return 'Asosiasi Penyelenggara Jasa Internet Indonesia (APJII)'

    return None

changes = []
for rid, p in records:
    c_p = canonical_pengelola_extended(p)
    if c_p and c_p != p:
        changes.append((rid, p, c_p))

print(f"Total rows to standardize: {len(changes)}")
from collections import Counter
counts = Counter((orig, canon) for _, orig, canon in changes)
for (orig, canon), cnt in counts.most_common():
    print(f"  {cnt:2d}x: '{orig}' -> '{canon}'")
