import re
from collections import Counter

with open('index.html', encoding='utf-8') as f:
    text = f.read()

# 1. Check duplicate IDs
ids = re.findall(r'id=["\']([^"\']+)["\']', text)
counts = Counter(ids)
dupes = {id_name: count for id_name, count in counts.items() if count > 1}
print("--- Duplicate IDs in index.html ---")
if dupes:
    for d, c in dupes.items():
        print(f"  ID '{d}' appears {c} times")
else:
    print("  No duplicate IDs found!")

# 2. Check for unescaped characters or broken syntax
print("\n--- Checking for malformed attributes ---")
lines = text.splitlines()
for idx, line in enumerate(lines, 1):
    # Check for unclosed tag brackets or double quotes issues
    if 'class=""' in line:
        pass
    # check for < within tag
    # check for onclick syntax issues
    if 'onclick=' in line:
        # check if quotes balanced
        pass

# 3. Check for any JS errors or unclosed elements in scripts inside index.html
print("\n--- Checking inline scripts in index.html ---")
scripts = re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>', text, re.DOTALL)
print(f"Found {len(scripts)} inline script blocks")
