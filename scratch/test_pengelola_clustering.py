import sqlite3
import re

conn = sqlite3.connect('telecom_portal.db')
cur = conn.cursor()
cur.execute('SELECT DISTINCT pengelola FROM collo_records WHERE pengelola IS NOT NULL AND pengelola != "" ORDER BY pengelola')
all_p = [r[0] for r in cur.fetchall()]

def normalize_pengelola_key(name):
    if not name:
        return ''
    s = str(name).strip()
    # Normalize typos and specific vendor names
    s_clean = s.upper()
    
    # Specific known typos / variants
    if 'BIZNE' in s_clean or 'BIZNET' in s_clean:
        return 'Biznet Data Center'
    if 'SIGMA CIPTA' in s_clean:
        return 'Sigma Cipta Caraka'
    if 'TELKOM DATA EKOSISTEM' in s_clean:
        return 'Telkom Data Ekosistem'
    if 'TELEKOMUNIKASI INDONESIA' in s_clean or 'TELKOM INDONESIA' in s_clean:
        return 'Telkom Indonesia'
    if 'TEKNOVATUS' in s_clean or 'TEKTOVANUS' in s_clean:
        return 'Teknovatus Solusi Sejahtera'
    if 'LOKA MAMPANG' in s_clean or 'LOKA AMAPANG' in s_clean:
        return 'Loka Mampang Indah Realty'
    if 'KARUNIA MEGA' in s_clean:
        return 'Karunia Megah Perkasa'
    if 'JEKAEL' in s_clean or 'JAKAEL' in s_clean:
        return 'Jekael Invesco'
    if 'P3SR' in s_clean and 'CITY TOWER' in s_clean:
        return 'P3SRS The City Tower'
    if 'MULTIVISION TOWER' in s_clean:
        return 'P3SRS Multivision Tower'
    if 'MENARA KARYA' in s_clean:
        return 'Perhimpunan Penghuni Menara Karya'
    if 'METROPOLITAN KENCANA' in s_clean or 'METROPOLITAN KENTJANA' in s_clean:
        return 'Metropolitan Kencana'
    if 'PATRA JASA' in s_clean:
        if 'OFFICE TOWER' in s_clean:
            return 'Patra Jasa Office Tower'
        return 'Patra Jasa'
    if 'PLAZA ADIKA' in s_clean or 'PLAZA ANDIKA' in s_clean:
        return 'Plaza Adika Lestari'
    if 'PERWITA' in s_clean or 'PERWIRA' in s_clean:
        return 'Perwita Margasakti'
    if 'PHINISINDO' in s_clean or 'PHISINDO' in s_clean:
        return 'Phinisindo Zamrud Nusantara'
    if 'PRAJA PURI' in s_clean:
        return 'Praja Puri Indah Real Estate'
    if 'PRIMA WIRA' in s_clean:
        return 'Prima Wira Utama'
    if 'PRINCETON DIGITAL' in s_clean:
        return 'Princeton Digital Group'
    if 'SAMPOERNA LAND' in s_clean:
        return 'Sampoerna Land'
    if 'SENAYAN TRIKARYA' in s_clean or 'SENAYAN TIRTAKARYA' in s_clean:
        return 'Senayan Trikarya Sempana'
    if 'SUKSES KELOLA' in s_clean or 'SUKSES KELOLE' in s_clean:
        return 'Sukses Kelola Persada'
    if 'SUPRA PRIMATAMA' in s_clean or 'SUPRA PRITAMA' in s_clean:
        return 'Supra Primatama Nusantara (Biznet Networks)'
    if 'ZOTA INDONESIA' in s_clean:
        return 'Zota Indonesia'
    if 'KRAKATAU INFORMATION' in s_clean:
        return 'Krakatau Information Technology'
    if 'KRAKATAU INDUSTRIAL' in s_clean or 'KRAKATAU SARANA' in s_clean:
        return 'Krakatau Sarana Properti'
    if 'PELINDO' in s_clean or 'PELABUHAN INDONESIA' in s_clean:
        return 'Pelabuhan Indonesia (Pelindo)'
    if 'PC 24' in s_clean or 'PC24' in s_clean:
        return 'PC 24 Telekomunikasi Indonesia'
    if 'NETTOCYBER' in s_clean:
        return 'Nettocyber Indonesia'
    if 'MENARA THAMRIN' in s_clean:
        return 'Menara Thamrin'
    if 'MEGA TELEKOMUNIKASI' in s_clean:
        return 'Mega Telekomunikasi Indonesia'
    if 'MEGA AKSES' in s_clean:
        return 'Mega Akses Persada'
    if 'MARMITRIA' in s_clean:
        return 'Marmitria Land'
    if 'KARYAGRAHA' in s_clean:
        return 'Karyagraha Nusantara'
    if 'INTILAND' in s_clean:
        return 'Intiland Tower'
    if 'INDOSAT' in s_clean:
        return 'Indosat Ooredoo Hutchison'
    if 'IFORTE' in s_clean:
        return 'iForte Solusi Infotek'
    if 'CENTRAL CIPTA' in s_clean:
        return 'Central Cipta Murdaya'
    if 'BUMI SERPONG DAMAI' in s_clean or ' BSD' in s_clean:
        return 'Bumi Serpong Damai (BSD)'
    if 'BERCA' in s_clean:
        return 'Berca Hardayaperdana'
    if 'CENTRAL GLOBAL' in s_clean:
        return 'Centra Global Investama'
    if 'CYBER NETWORK' in s_clean:
        return 'Cyber Network Indonesia'
    if 'DCI INDONESIA' in s_clean:
        return 'DCI Indonesia'
    if 'GRAHA SUMBER' in s_clean:
        return 'Graha Sumber Prima Elektronik'
    if 'INDONET' in s_clean:
        return 'Indonet'
    if 'JAKARTA INDUSTRIAL ESTATE' in s_clean or 'JIEP' in s_clean:
        return 'Jakarta Industrial Estate Pulogadung (JIEP)'
    if 'JAKARTA LAND' in s_clean:
        return 'Jakarta Land'
    if 'KAI COMMUTER' in s_clean:
        return 'KAI Commuter Jabodetabek'
    if 'KERETA API INDONESIA' in s_clean:
        return 'Kereta Api Indonesia (KAI)'
    if 'LINK NET' in s_clean:
        return 'Link Net'
    if 'MNC KABEL' in s_clean or 'MNC MEDIA' in s_clean:
        return 'MNC Kabel Mediacom'
    if 'MORA TELEMATIKA' in s_clean:
        return 'Mora Telematika Indonesia'
    if 'MULTI KONTROL' in s_clean or 'MULTIKONTROL' in s_clean:
        return 'Multi Kontrol Nusantara'
    if 'NETCITI' in s_clean:
        return 'Netciti Persada'
    if 'NTT INDONESIA' in s_clean or 'NTT ' in s_clean:
        return 'NTT Indonesia'
    if 'SMARTFREN' in s_clean:
        return 'Smartfren Telecom'
    if 'XL AXIATA' in s_clean:
        return 'XL Axiata'
    if 'APJII' in s_clean:
        return 'APJII'

    # General strip of PT, Tbk, Persero, commas, etc.
    res = s
    res = re.sub(r'^(?:PT\.?|CV\.?)\s+', '', res, flags=re.I)
    res = re.sub(r'[, ]+(?:PT\.?|CV\.?)$', '', res, flags=re.I)
    res = re.sub(r'\s*\((?:Persero)\)', '', res, flags=re.I)
    res = re.sub(r'\s+Tbk\.?', '', res, flags=re.I)
    res = re.sub(r'\s+', ' ', res).strip()
    return res

groups = {}
for p in all_p:
    norm = normalize_pengelola_key(p)
    groups.setdefault(norm, []).append(p)

# Print all groups with > 1 raw variant
print(f"Total raw: {len(all_p)} -> Total normalized canonical: {len(groups)}")
print("\n--- GROUPS WITH DUPLICATES / VARIANTS ---")
for norm, raw_list in sorted(groups.items()):
    if len(raw_list) > 1:
        print(f"\nCanonical: '{norm}' ({len(raw_list)} variants):")
        for r in raw_list:
            print(f"  - {repr(r)}")
