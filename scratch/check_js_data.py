import re

with open('sitac_collo_data.js', 'r', encoding='utf-8') as f:
    text = f.read()

matches = re.findall(r'"pengelola":\s*"([^"]*bizn[^"]*)"', text, re.IGNORECASE)
print("Unique Biznet pengelola in sitac_collo_data.js:", set(matches))

pa_match = re.search(r'\{[^{}]*"A821103000308-2"[^{}]*\}', text)
if pa_match:
    print("PA in sitac_collo_data.js:", pa_match.group(0)[:200])
else:
    print("PA not found in single line")
