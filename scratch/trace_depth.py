with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start = 1376
end = 1660

depth = 0
for idx in range(start - 1, end):
    line = lines[idx]
    opens = line.count('<div')
    closes = line.count('</div')
    depth += opens - closes
    print(f'L{idx+1} [depth={depth}] {line.strip()[:80]}')
