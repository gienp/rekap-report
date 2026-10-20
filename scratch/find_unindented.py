with open('server.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx in range(437, len(lines)):
    line = lines[idx]
    if line.strip() and not line.startswith(' ') and not line.startswith('\t') and not line.startswith('#'):
        print(f"Column 0 at Line {idx+1}: {repr(line[:60])}")
