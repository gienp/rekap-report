import sqlite3
import json
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "telecom_portal.db")
COLLO_JSON = os.path.join(BASE_DIR, "sitac_collo_data.json")
COLLO_JS = os.path.join(BASE_DIR, "sitac_collo_data.js")
SITAC_JSON = os.path.join(BASE_DIR, "sitac_data.json")
SITAC_JS = os.path.join(BASE_DIR, "sitac_data.js")

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# 1. Fetch SITAC
cursor.execute("SELECT * FROM sitac_records ORDER BY id ASC")
all_sitac = [dict(r) for r in cursor.fetchall()]

# 2. Fetch Collo
cursor.execute("SELECT * FROM collo_records ORDER BY id ASC")
all_collo = [dict(r) for r in cursor.fetchall()]

# 3. Fetch Gangguan
cursor.execute("SELECT * FROM gangguan_records ORDER BY id ASC")
all_gangguan = [dict(r) for r in cursor.fetchall()]

# 4. Fetch Rekap Efisiensi
cursor.execute("SELECT * FROM rekap_efisiensi ORDER BY tahun ASC")
all_efisiensi = [dict(r) for r in cursor.fetchall()]

# 5. Fetch Network Links (Circuit routes Orig -> Term)
cursor.execute("SELECT * FROM network_links ORDER BY id ASC")
raw_links = [dict(r) for r in cursor.fetchall()]
all_links = []
for l in raw_links:
    all_links.append({
        "id": l["id"],
        "collo_id": l["collo_id"],
        "no_so": l["no_so"],
        "sid": l["sid"],
        "pelanggan": l["pelanggan"],
        "pengelola": l["pengelola"],
        "layanan": l["layanan"],
        "kapasitas": l["kapasitas"],
        "biaya_sewa_tahun": l["biaya_sewa_tahun"],
        "status": l["status"],
        "originating": {
            "label": l["orig_label"],
            "raw": l["orig_name"],
            "lat": l["orig_lat"],
            "lng": l["orig_lng"]
        },
        "terminating": {
            "label": l["term_label"],
            "raw": l["term_name"],
            "lat": l["term_lat"],
            "lng": l["term_lng"]
        }
    })

conn.close()

print(f"Loaded from DB:")
print(f"  - sitac_records: {len(all_sitac)}")
print(f"  - collo_records: {len(all_collo)}")
print(f"  - gangguan_records: {len(all_gangguan)}")
print(f"  - rekap_efisiensi: {len(all_efisiensi)}")
print(f"  - network_links: {len(all_links)}")

# Update COLLO_JSON
if os.path.exists(COLLO_JSON):
    with open(COLLO_JSON, "r", encoding="utf-8") as f:
        cdata = json.load(f)
    
    cdata["sitac_records"] = all_sitac
    cdata["collo_records"] = all_collo
    cdata["gangguan_records"] = all_gangguan
    cdata["rekap_efisiensi"] = all_efisiensi
    cdata["network_links"] = all_links
    
    if "metadata" not in cdata:
        cdata["metadata"] = {}
    cdata["metadata"]["total_sitac"] = len(all_sitac)
    cdata["metadata"]["total_collo"] = len(all_collo)
    cdata["metadata"]["total_collo_active"] = sum(1 for c in all_collo if c.get("status") == "ACTIVE")
    cdata["metadata"]["total_gangguan"] = len(all_gangguan)
    cdata["metadata"]["last_updated"] = "2026-10-21 09:30:00"

    if "summary" not in cdata:
        cdata["summary"] = {}
    cdata["summary"]["total_sitac"] = len(all_sitac)
    cdata["summary"]["total_collo"] = len(all_collo)
    cdata["summary"]["total_gangguan"] = len(all_gangguan)
    cdata["summary"]["total_network_links"] = len(all_links)
    cdata["summary"]["active_network_links"] = sum(1 for l in all_links if l.get("status") == "ACTIVE")
    cdata["summary"]["active_circuits"] = sum(1 for c in all_collo if c.get("status") == "ACTIVE")

    with open(COLLO_JSON, "w", encoding="utf-8") as f:
        json.dump(cdata, f, ensure_ascii=False, indent=2)
    print(f"[OK] Saved {COLLO_JSON}")

    with open(COLLO_JS, "w", encoding="utf-8") as f:
        f.write(f"window.SITAC_COLLO_DATA = {json.dumps(cdata, ensure_ascii=False)};")
    print(f"[OK] Saved {COLLO_JS}")

# Update SITAC_JSON if exists
if os.path.exists(SITAC_JSON):
    with open(SITAC_JSON, "r", encoding="utf-8") as f:
        sdata = json.load(f)
    sdata["sitac_records"] = all_sitac
    sdata["gangguan_records"] = all_gangguan
    sdata["rekap_efisiensi"] = all_efisiensi
    with open(SITAC_JSON, "w", encoding="utf-8") as f:
        json.dump(sdata, f, ensure_ascii=False, indent=2)
    print(f"[OK] Saved {SITAC_JSON}")

    if os.path.exists(SITAC_JS):
        with open(SITAC_JS, "w", encoding="utf-8") as f:
            f.write(f"window.SITAC_RAW_DATA = {json.dumps(sdata, ensure_ascii=False)};")
        print(f"[OK] Saved {SITAC_JS}")

print("[COMPLETE] All files synced successfully!")
