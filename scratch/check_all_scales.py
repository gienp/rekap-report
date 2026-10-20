with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Find all occurrences of scales: { ... }
scale_matches = [m for m in re.finditer(r'scales\s*:\s*\{', text)]
print(f"Total scales blocks found: {len(scale_matches)}")

for idx, m in enumerate(scale_matches):
    start = m.start()
    # grab next 400 chars
    block = text[start:start+400]
    line_num = text[:start].count('\n') + 1
    # Check if border: { display: false } is present
    has_border_false = 'border: { display: false }' in block or 'border:{display:false}' in block
    print(f"Scale {idx+1} at line {line_num}: has border:false? {has_border_false}")
    if not has_border_false:
        print("   Snippet:", block[:200].replace('\n', ' '))
