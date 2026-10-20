import openpyxl
import sqlite3
import datetime
import re
import json

EXCEL_FILE = "20241231_ Export Perizinan.xlsx"
DB_FILE = "telecom_portal.db"

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

    if re.match(r'^[a-zA-Z]\d{8,}', val_str) or re.match(r'^(PA|ID|Tiket|AR|R\d)', val_str, re.I):
        return 0, val_str

    m_mult = re.search(r'(\d+)\s*[xX*]\s*(\d+)', val_str)
    if m_mult:
        try:
            return int(m_mult.group(1)) * int(m_mult.group(2)), val_str
        except:
            pass

    cleaned = re.sub(r'[^\d.,]', '', val_str)
    if not cleaned: return 0, val_str

    if '.' in cleaned and ',' in cleaned:
        if cleaned.rfind(',') > cleaned.rfind('.'):
            cleaned = cleaned.replace('.', '').replace(',', '.')
        else:
            cleaned = cleaned.replace(',', '')
    elif '.' in cleaned:
        parts = cleaned.split('.')
        if len(parts[-1]) == 3:
            cleaned = cleaned.replace('.', '')
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

wb = openpyxl.load_workbook(EXCEL_FILE, data_only=True)
ws = wb["RAW data"]
rows = [r for r in list(ws.iter_rows(values_only=True))[1:] if r[19] == 2024]
print(f"Total 2024 rows to process: {len(rows)}")

status_cnt = Counter()
for r in rows:
    st = normalize_status(r[11])
    status_cnt[st] += 1
print("Status breakdown of all 235 rows:", status_cnt)
