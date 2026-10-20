import urllib.request, json

req = urllib.request.urlopen("http://localhost:8888/api/rekap-efisiensi", timeout=5)
data = json.loads(req.read().decode('utf-8'))
if isinstance(data, dict):
    print("Rekap efisiensi is dict. Keys:", list(data.keys()))
    if 'regional' in data:
        print("Regional count:", len(data['regional']))
        for r in data['regional']:
            print(" ", r)
elif isinstance(data, list):
    print("Rekap efisiensi is list. Length:", len(data))
    for r in data:
        print(" ", r)
