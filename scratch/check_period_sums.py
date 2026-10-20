import urllib.request
import json

for p in ['ALL', '2024', '2025', '2026']:
    url = f'http://localhost:8888/api/executive/summary?year={p}'
    resp = urllib.request.urlopen(url)
    data = json.loads(resp.read().decode())
    collo = data.get('collo', {})
    print(f"--- Periode {p} ---")
    print(f"Total Sirkuit Aktif : {collo.get('active_count')}")
    print(f"  - Kontrak Baru    : {collo.get('new_active_count')}")
    print(f"  - Carry-over      : {collo.get('carry_over_active_count')}")
    print(f"Revenue Aktif       : Rp {collo.get('active_revenue'):,}")
    print(f"Biaya Sewa Aktif    : Rp {collo.get('active_biaya'):,}")
    print(f"Gross Margin Aktif  : Rp {collo.get('active_margin'):,}")
    print()
