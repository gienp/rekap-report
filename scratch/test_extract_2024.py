import openpyxl
import re
import datetime
from collections import Counter

GEO_ANCHORS = {
    'tanah abang': (-6.1855, 106.8155),
    'kebon sirih': (-6.1837, 106.8290),
    'menteng': (-6.1950, 106.8320),
    'kemayoran': (-6.1550, 106.8520),
    'cideng': (-6.1730, 106.8110),
    'merdeka barat': (-6.1760, 106.8230),
    'sudirman': (-6.2150, 106.8220),
    'kuningan': (-6.2280, 106.8310),
    'setiabudi': (-6.2110, 106.8280),
    'duren tiga': (-6.2520, 106.8390),
    'tebet': (-6.2300, 106.8520),
    'ancol': (-6.1260, 106.8320),
    'pluit': (-6.1180, 106.7910),
    'sunter': (-6.1420, 106.8710),
    'marunda': (-6.1050, 106.9650),
    'kelapa gading': (-6.1580, 106.9080),
    'daan mogot': (-6.1580, 106.7350),
    'cengkareng': (-6.1450, 106.7280),
    'grogol': (-6.1660, 106.7890),
    'halim': (-6.2620, 106.8910),
    'cawang': (-6.2480, 106.8680),
    'cakung': (-6.1880, 106.9510),
    'buaran': (-6.2200, 106.9180),
    'bekasi': (-6.2380, 106.9750),
    'harapan indah': (-6.1830, 106.9820),
    'cikarang': (-6.2610, 107.1520),
    'depok': (-6.3950, 106.8230),
    'limo': (-6.3680, 106.7720),
    'tangerang': (-6.1780, 106.6310),
    'bsd': (-6.3010, 106.6520),
    'serpong': (-6.3210, 106.6690),
    'greenlake': (-6.1850, 106.7020),
    'bogor': (-6.5950, 106.7900),
    'bojong': (-6.4950, 106.7950),
    'serang': (-6.1100, 106.1500),
    'karawang': (-6.3150, 107.2950),
    'jakarta': (-6.2000, 106.8200)
}

def clean_text(val):
    if val is None: return ""
    s = str(val).strip()
    if s.lower() in ("none", "null", "-"): return ""
    return s

def parse_currency(val):
    if val is None: return 0, ""
    if isinstance(val, (int, float)): return int(round(val)), ""
    val_str = str(val).strip()
    if not val_str or val_str in ("-", "None", "0"): return 0, ""

    in_kind = ['sampah', 'liter', 'meter', 'kabel', 'fiber', 'unit', 'buah', 'semen', 'cat', 'wifi']
    if any(k in val_str.lower() for k in in_kind): return 0, val_str

    if not re.search(r'\d', val_str): return 0, val_str

    cleaned = re.sub(r'[^\d.,]', '', val_str)
    if '.' in cleaned and ',' not in cleaned:
        parts = cleaned.split('.')
        if len(parts) > 1 and all(len(p) == 3 for p in parts[1:]):
            cleaned = cleaned.replace('.', '')
        else:
            cleaned = cleaned.replace('.', '')
    elif ',' in cleaned and '.' in cleaned:
        cleaned = cleaned.replace('.', '').replace(',', '.')
    elif ',' in cleaned:
        cleaned = cleaned.replace(',', '.')

    try:
        num = float(cleaned)
        return int(round(num)), (val_str if " " in val_str and not val_str.startswith("Rp") else "")
    except ValueError:
        return 0, val_str

def parse_date(val):
    if val is None: return None
    if isinstance(val, (datetime.datetime, datetime.date)):
        return val.strftime("%Y-%m-%d")
    val_str = str(val).strip()
    if not val_str or val_str.lower() in ("none", "null", "-", "0000-00-00"):
        return None
    match = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})', val_str)
    if match:
        y, m, d = match.groups()
        return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
    match = re.match(r'^(\d{1,2})[/-](\d{1,2})[/-](\d{4})', val_str)
    if match:
        d, m, y = match.groups()
        return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
    return None

def normalize_status(val):
    if not val: return "Finish"
    s = str(val).strip().lower()
    if "finish" in s or "selesai" in s: return "Finish"
    if "cancel" in s or "batal" in s: return "Cancel"
    if "ongoing" in s or "proses" in s or "jalan" in s: return "Ongoing"
    if "stop clock" in s or "hold" in s or "tunda" in s: return "Hold"
    return "Finish"

def resolve_coordinates(raw_coord, address_text, record_id):
    if raw_coord:
        m = re.search(r'([-+]?\d+\.\d+)[,\s]+([-+]?\d+\.\d+)', str(raw_coord))
        if m:
            lat = float(m.group(1))
            lng = float(m.group(2))
            if -11.0 <= lat <= 6.0 and 95.0 <= lng <= 141.0:
                return round(lat, 6), round(lng, 6), "EXACT"

    if address_text:
        lower_addr = address_text.lower()
        for key, (base_lat, base_lng) in GEO_ANCHORS.items():
            if key in lower_addr:
                offset_lat = ((record_id * 17) % 31 - 15) * 0.0018
                offset_lng = ((record_id * 23) % 31 - 15) * 0.0018
                return round(base_lat + offset_lat, 6), round(base_lng + offset_lng, 6), "GEOCODED"

    offset_lat = ((record_id * 13) % 41 - 20) * 0.003
    offset_lng = ((record_id * 19) % 41 - 20) * 0.003
    return round(-6.2088 + offset_lat, 6), round(106.8456 + offset_lng, 6), "AREA_DEFAULT"

wb = openpyxl.load_workbook('20241231_ Export Perizinan.xlsx', data_only=True)
sheet = wb['RAW data']
rows = list(sheet.iter_rows(values_only=True))

extracted_2024 = []
for idx, r in enumerate(rows[1:], start=2):
    if r[19] == 2024:
        seq_id = len(extracted_2024) + 452 # starting after existing 451
        excel_no = r[0] if isinstance(r[0], int) else seq_id
        no_pa = clean_text(r[1])
        pelanggan = clean_text(r[2])
        ptl = clean_text(r[3])
        pic = clean_text(r[4])
        terminating = clean_text(r[6])
        coord_raw = clean_text(r[7])

        lat, lng, ctype = resolve_coordinates(coord_raw, terminating, seq_id)

        sewa_otc_raw = clean_text(r[8]).lower()
        otc_val, _ = parse_currency(r[9])
        sewa_val, _ = parse_currency(r[10])

        biaya_final = otc_val
        biaya_sewa_bulan = sewa_val

        # Check if sewa_otc label is present
        if 'sewa' in sewa_otc_raw:
            sewa_otc = 'Sewa'
        elif 'otc' in sewa_otc_raw:
            sewa_otc = 'OTC'
        else:
            if biaya_sewa_bulan > 0 and biaya_final > 0:
                sewa_otc = 'OTC & Sewa'
            elif biaya_sewa_bulan > 0:
                sewa_otc = 'Sewa'
            elif biaya_final > 0:
                sewa_otc = 'OTC'
            else:
                sewa_otc = '-'

        update_pekerjaan = clean_text(r[17])
        
        # Check initial negotiation cost in update_pekerjaan
        biaya_awal = biaya_final
        catatan_awal = ''
        m_neg = re.search(r'awal\s*(?:nya)?\s*(?:sebesar)?\s*(\d+[.,]?\d*)\s*(?:jt|juta|000\.000)', update_pekerjaan, re.IGNORECASE)
        if m_neg:
            try:
                num_str = m_neg.group(1).replace(',', '.')
                parsed_awal = int(round(float(num_str) * 1_000_000))
                if parsed_awal > biaya_final:
                    biaya_awal = parsed_awal
            except Exception:
                pass

        if biaya_awal > 0 and biaya_awal >= biaya_final:
            efisiensi_rupiah = biaya_awal - biaya_final
            efisiensi_persen = round((efisiensi_rupiah / biaya_awal) * 100, 2)
        else:
            efisiensi_rupiah = 0
            efisiensi_persen = 0.0

        is_berbiaya = 1 if (biaya_final > 0 or biaya_sewa_bulan > 0 or biaya_awal > 0) else 0

        progress = normalize_status(r[11])
        date_dispos = parse_date(r[12])
        date_close = parse_date(r[14])
        
        durasi_hari = None
        if isinstance(r[16], (int, float)):
            durasi_hari = int(round(r[16]))
        elif date_dispos and date_close:
            try:
                d1 = datetime.datetime.strptime(date_dispos, "%Y-%m-%d")
                d2 = datetime.datetime.strptime(date_close, "%Y-%m-%d")
                durasi_hari = max(0, (d2 - d1).days)
            except:
                durasi_hari = 0
        else:
            durasi_hari = 0

        if durasi_hari <= 7:
            aging_cat = 'green'
        elif durasi_hari <= 14:
            aging_cat = 'yellow'
        else:
            aging_cat = 'red'

        bulan = r[18] if isinstance(r[18], int) else (int(date_dispos.split('-')[1]) if date_dispos else 1)
        tahun = 2024

        rec = {
            'id': seq_id,
            'excel_no': excel_no,
            'no_pa': no_pa,
            'pelanggan': pelanggan,
            'ptl': ptl,
            'pic_perijinan': pic,
            'tiering': '',
            'poin': None,
            'terminating': terminating,
            'latitude': lat,
            'longitude': lng,
            'coord_type': ctype,
            'biaya_permintaan_awal': biaya_awal,
            'catatan_biaya_awal': catatan_awal,
            'sewa_otc': sewa_otc,
            'biaya_final': biaya_final,
            'biaya_sewa_bulan': biaya_sewa_bulan,
            'efisiensi_rupiah': efisiensi_rupiah,
            'efisiensi_persen': efisiensi_persen,
            'is_berbiaya': is_berbiaya,
            'progress': progress,
            'date_pa': None,
            'date_dispos': date_dispos,
            'date_close': date_close,
            'durasi_hari': durasi_hari,
            'aging_category': aging_cat,
            'update_pekerjaan': update_pekerjaan,
            'bulan': bulan,
            'tahun': tahun,
            'created_at': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'foto_bukti': None
        }
        extracted_2024.append(rec)

print(f"Successfully processed {len(extracted_2024)} records for 2024.")
print("Statuses:", Counter(r['progress'] for r in extracted_2024))
print("Aging categories:", Counter(r['aging_category'] for r in extracted_2024))
print("Coordinate types:", Counter(r['coord_type'] for r in extracted_2024))
print("Total biaya final OTC: Rp", f"{sum(r['biaya_final'] for r in extracted_2024):,}")
print("Total biaya sewa bulan: Rp", f"{sum(r['biaya_sewa_bulan'] for r in extracted_2024):,}")
print("Total efisiensi: Rp", f"{sum(r['efisiensi_rupiah'] for r in extracted_2024):,}")
print("First record:", extracted_2024[0])
print("Last record:", extracted_2024[-1])
