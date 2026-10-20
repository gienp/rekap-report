import urllib.request

try:
    req = urllib.request.urlopen("http://localhost:8888/api/meta/options", timeout=5)
    print("Meta options status:", req.status)
    data = req.read().decode('utf-8')
    print("Meta options data:", data[:200])
except Exception as e:
    print("Meta options error:", e)

try:
    req = urllib.request.urlopen("http://localhost:8888/api/sitac?region=TANGERANG&pageSize=5", timeout=5)
    print("Sitac status:", req.status)
    data = req.read().decode('utf-8')
    print("Sitac data:", data[:200])
except Exception as e:
    print("Sitac error:", e)
    if hasattr(e, 'read'):
        print("Error body:", e.read().decode('utf-8'))
