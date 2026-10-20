import re

with open('styles.css', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

matches = re.finditer(r'([^{}]+)\{([^{}]+)\}', content)
for m in matches:
    sel = m.group(1).strip()
    body = m.group(2).strip()
    if 'data-theme' in sel and 'font' in body:
        print(f"SELECTOR: {sel}")
        for line in body.split(';'):
            if 'font' in line:
                print(f"  {line.strip()}")
        print('-'*40)
