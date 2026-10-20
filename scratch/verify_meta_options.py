import urllib.request, json

req = urllib.request.urlopen("http://localhost:8888/api/meta/options", timeout=5)
data = json.loads(req.read().decode('utf-8'))
biz = [p for p in data.get('pengelola', []) if 'bizn' in p.lower()]
print("Biznet options from server.py:", biz)

# Also check other common variations
for kw in ['sigma', 'telkom', 'loka', 'jekael', 'patra']:
    matches = [p for p in data.get('pengelola', []) if kw in p.lower()]
    print(f"Keywords '{kw}':", matches)
