with open('server.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines, 1):
    if 'PORT' in line:
        print(f"Line {idx}: {line.strip()}")
