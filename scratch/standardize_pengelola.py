import sqlite3
import re
import json
import os

DB_PATH = 'telecom_portal.db'
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("SELECT id, pengelola FROM collo_records")
records = cur.fetchall()

def canonical_pengelola(s):
    if not s:
        return ''
    raw = str(s).strip()
    u = raw.upper()

    # 1. Biznet Data Center (All variations in user's screenshot)
    if 'BIZNE' in u or 'BIZNET' in u:
        if 'SUPRA PRIMATAMA' in u or 'BIZNET NETWORKS' in u:
            return 'Supra Primatama Nusantara (Biznet Networks)'
        return 'Biznet Data Center'

    # 2. Sigma Cipta Caraka (TelkomSigma)
    if 'SIGMA CIPTA' in u:
        return 'Sigma Cipta Caraka'

    # 3. Telkom Data Ekosistem (NeutraDC)
    if 'TELKOM DATA EKOSISTEM' in u:
        return 'Telkom Data Ekosistem'

    # 4. Telkom Indonesia (Excluding PC24, Mega Telekomunikasi, Graha Telekomunikasi)
    if ('TELKOM INDONESIA' in u or 'TELEKOMUNIKASI INDONESIA' in u) and not any(x in u for x in ['MEGA', 'PC 24', 'PC24', 'GRAHA', 'MORA']):
        return 'Telkom Indonesia'

    # 5. Teknovatus Solusi Sejahtera
    if 'TEKNOVATUS' in u or 'TEKTOVANUS' in u:
        return 'Teknovatus Solusi Sejahtera'

    # 6. Loka Mampang Indah Realty
    if 'LOKA MAMPANG' in u or 'LOKA AMAPANG' in u:
        return 'Loka Mampang Indah Realty'

    # 7. Karunia Megah Perkasa
    if 'KARUNIA MEGA' in u:
        return 'Karunia Megah Perkasa'

    # 8. Jekael Invesco
    if ('JEKAEL' in u or 'JAKAEL' in u) and 'BINAJASA' not in u:
        return 'Jekael Invesco'

    # 9. P3SRS City Tower
    if 'P3SR' in u and 'CITY TOWER' in u:
        return 'P3SRS The City Tower'

    # 10. P3SRS Multivision Tower
    if 'MULTIVISION TOWER' in u:
        return 'P3SRS Multivision Tower'

    # 11. Menara Karya
    if 'MENARA KARYA' in u:
        return 'Perhimpunan Penghuni Menara Karya'

    # 12. Metropolitan Kencana
    if 'METROPOLITAN KENCANA' in u or 'METROPOLITAN KENTJANA' in u:
        return 'Metropolitan Kencana'

    # 13. Patra Jasa
    if 'PATRA JASA' in u:
        if 'OFFICE TOWER' in u:
            return 'Patra Jasa Office Tower'
        return 'Patra Jasa'

    # 14. Plaza Adika Lestari
    if 'PLAZA ADIKA' in u or 'PLAZA ANDIKA' in u:
        return 'Plaza Adika Lestari'

    # 15. Perwita Margasakti
    if 'PERWITA' in u or 'PERWIRA MARGASAKTI' in u:
        return 'Perwita Margasakti'

    # 16. Phinisindo Zamrud Nusantara
    if 'PHINISINDO' in u or 'PHISINDO' in u:
        return 'Phinisindo Zamrud Nusantara'

    # 17. Praja Puri Indah Real Estate
    if 'PRAJA PURI' in u:
        return 'Praja Puri Indah Real Estate'

    # 18. Prima Wira Utama
    if 'PRIMA WIRA' in u:
        return 'Prima Wira Utama'

    # 19. Princeton Digital Group
    if 'PRINCETON DIGITAL' in u:
        return 'Princeton Digital Group'

    # 20. Sampoerna Land
    if 'SAMPOERNA LAND' in u:
        return 'Sampoerna Land'

    # 21. Senayan Trikarya Sempana
    if 'SENAYAN TRIKARYA' in u or 'SENAYAN TIRTAKARYA' in u:
        return 'Senayan Trikarya Sempana'

    # 22. Sukses Kelola Persada
    if 'SUKSES KELOLA' in u or 'SUKSES KELOLE' in u:
        return 'Sukses Kelola Persada'

    # 23. Supra Primatama Nusantara
    if 'SUPRA PRIMATAMA' in u or 'SUPRA PRITAMA' in u:
        return 'Supra Primatama Nusantara (Biznet Networks)'

    # 24. Zota Indonesia
    if 'ZOTA INDONESIA' in u:
        return 'Zota Indonesia'

    # 25. Krakatau
    if 'KRAKATAU INFORMATION' in u:
        return 'Krakatau Information Technology'
    if 'KRAKATAU INDUSTRIAL' in u or 'KRAKATAU SARANA' in u:
        return 'Krakatau Sarana Properti'

    # 26. Pelindo
    if 'PELINDO' in u or 'PELABUHAN INDONESIA' in u:
        return 'Pelabuhan Indonesia (Pelindo)'

    # 27. PC 24 Telekomunikasi
    if 'PC 24' in u or 'PC24' in u:
        return 'PC 24 Telekomunikasi Indonesia'

    # 28. Nettocyber Indonesia
    if 'NETTOCYBER' in u:
        return 'Nettocyber Indonesia'

    # 29. Menara Thamrin
    if 'MENARA THAMRIN' in u:
        return 'Menara Thamrin'

    # 30. Mega Telekomunikasi Indonesia
    if 'MEGA TELEKOMUNIKASI' in u:
        return 'Mega Telekomunikasi Indonesia'

    # 31. Mega Akses Persada
    if 'MEGA AKSES PERSADA' in u:
        return 'Mega Akses Persada'

    # 32. Marmitria Land
    if 'MARMITRIA' in u:
        return 'Marmitria Land'

    # 33. Karyagraha Nusantara
    if 'KARYAGRAHA' in u:
        return 'Karyagraha Nusantara'

    # 34. Bumi Serpong Damai (BSD)
    if 'BUMI SERPONG DAMAI' in u:
        return 'Bumi Serpong Damai (BSD)'

    # 35. DCI Indonesia
    if 'DCI INDONESIA' in u or 'DCI  INDONESIA' in u:
        return 'DCI Indonesia'

    # 36. Dwi Tunggal Putra
    if 'DWI TUNGGAL' in u:
        return 'Dwi Tunggal Putra'

    # 37. KAI Commuter
    if 'KAI COMMUTER' in u:
        return 'KAI Commuter Jabodetabek'
    if 'KERETA API INDONESIA' in u:
        return 'Kereta Api Indonesia (KAI)'

    # 38. Link Net
    if 'LINK NET' in u or 'LINKNET' in u:
        return 'Link Net'

    # 39. MNC Kabel Mediacom
    if 'MNC KABEL' in u:
        return 'MNC Kabel Mediacom'

    # 40. Multi Kontrol Nusantara
    if 'MULTI KONTROL' in u or 'MULTIKONTROL' in u:
        return 'Multi Kontrol Nusantara'

    # 41. Netciti Persada
    if 'NETCITI' in u:
        return 'Netciti Persada'

    # 42. NTT Indonesia
    if 'NTT INDONESIA' in u:
        return 'NTT Indonesia'

    # 43. Smartfren Telecom
    if 'SMARTFREN' in u:
        return 'Smartfren Telecom'

    # 44. XL Axiata
    if 'XL AXIATA' in u:
        return 'XL Axiata'

    # 45. Persatuan Penghuni Perkantoran Plaza
    if 'PERSATUAN PENGHUNI' in u and 'PLAZ' in u:
        return 'Persatuan Penghuni Perkantoran Plaza'

    # General strip: Remove leading/trailing PT, CV, (Persero), Tbk, commas, double spaces
    clean = raw
    clean = re.sub(r'^(?:PT\.?|CV\.?)\s+', '', clean, flags=re.I)
    clean = re.sub(r'[, ]+(?:PT\.?|CV\.?)$', '', clean, flags=re.I)
    clean = re.sub(r'\s*\((?:Persero)\)', '', clean, flags=re.I)
    clean = re.sub(r'\s+Tbk\.?', '', clean, flags=re.I)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean

updated_count = 0
for r in records:
    orig = r['pengelola']
    canon = canonical_pengelola(orig)
    if canon and canon != orig:
        cur.execute("UPDATE collo_records SET pengelola = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (canon, r['id']))
        updated_count += 1

conn.commit()
print(f"Updated {updated_count} collo_records with normalized canonical pengelola.")

# Verify distinct Biznet values
cur.execute("SELECT DISTINCT pengelola FROM collo_records WHERE pengelola LIKE '%Bizn%' ORDER BY pengelola")
biz_rows = [r[0] for r in cur.fetchall()]
print(f"Distinct Biznet values after update: {biz_rows}")

# Sync to sitac_collo_data.json and sitac_collo_data.js
cur.execute("SELECT * FROM collo_records ORDER BY id ASC")
collo_all = [dict(r) for r in cur.fetchall()]

cur.execute("SELECT * FROM sitac_records ORDER BY id ASC")
sitac_all = [dict(r) for r in cur.fetchall()]

cur.execute("SELECT * FROM gangguan_records ORDER BY id ASC")
gangguan_all = [dict(r) for r in cur.fetchall()]

conn.close()

json_path = 'sitac_collo_data.json'
existing_json = {}
if os.path.exists(json_path):
    with open(json_path, 'r', encoding='utf-8') as f:
        existing_json = json.load(f)

existing_json['collo_records'] = collo_all
existing_json['sitac_records'] = sitac_all
existing_json['gangguan_records'] = gangguan_all

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(existing_json, f, indent=2, ensure_ascii=False)

js_path = 'sitac_collo_data.js'
with open(js_path, 'w', encoding='utf-8') as f:
    f.write('window.SITAC_COLLO_DATA = ')
    json.dump(existing_json, f, indent=2, ensure_ascii=False)
    f.write(';\n')

print("Successfully synced JSON and JS files with normalized pengelola!")
