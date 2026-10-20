import re

with open('server.py', 'r', encoding='utf-8') as f:
    text = f.read()

endpoints = re.findall(r'["\'](/api/[a-zA-Z0-9_\-\/]+)["\']', text)
for ep in sorted(set(endpoints)):
    print(ep)
