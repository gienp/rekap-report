with open('styles.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if any(k in l.lower() for k in ['canvas', 'pbi-visual', 'chart-card', 'chart-container', 'chartwrap']):
        clean = l.strip().encode('ascii', 'replace').decode('ascii')
        print(f'{i+1}: {clean}')
        for j in range(max(0, i-2), min(i+8, len(lines))):
            cj = lines[j].strip().encode('ascii', 'replace').decode('ascii')
            print(f'   {j+1}: {cj}')
