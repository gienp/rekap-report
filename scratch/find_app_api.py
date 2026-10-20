with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if '/api/meta/options' in l:
        print(f"meta options: line {i+1}")
    if '/api/collo' in l:
        print(f"collo api: line {i+1} -> {l.strip()[:60]}")
