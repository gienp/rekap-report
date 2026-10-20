import urllib.request, json

req = urllib.request.urlopen("http://localhost:8888/api/sitac?region=ALL&pageSize=5", timeout=5)
data = json.loads(req.read().decode('utf-8'))
print("Region stats keys:", list(data.get('region_stats', {}).keys()))
for reg, stats in data.get('region_stats', {}).items():
    print(f"  {reg}: total={stats.get('total')}, awal={stats.get('biaya_awal')}, final={stats.get('biaya_final')}, hemat={stats.get('hemat_rupiah')} ({stats.get('hemat_persen')}%)")
