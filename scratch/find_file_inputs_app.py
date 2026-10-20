with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines, 1):
    low = line.lower()
    if 'type="file"' in low or 'type=\'file\'' in low or 'fotoinput' in low or 'addsitacfoto' in low:
        print(f"Line {idx}: {line.strip()[:100]}")
