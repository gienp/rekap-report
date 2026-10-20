import urllib.request
import json

# Check if server is running on port 8000 or other
ports = [8000, 5000, 3000, 8080]
for p in ports:
    try:
        url = f"http://localhost:{p}/api/meta/options"
        req = urllib.request.urlopen(url, timeout=2)
        data = json.loads(req.read().decode('utf-8'))
        print(f"Server on port {p} returned {len(data.get('pengelola', []))} pengelola:")
        biz = [x for x in data.get('pengelola', []) if 'bizn' in x.lower()]
        print(f"  Biznet entries on port {p}:", biz)
    except Exception as e:
        # print(f"Port {p} failed: {e}")
        pass
