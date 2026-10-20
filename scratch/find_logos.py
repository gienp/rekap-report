import os, glob

keywords = ['logo', 'brand', 'iconplus', 'icon_plus', 'pln', 'favicon', '.png', '.svg', '.jpg']

for root, dirs, files in os.walk('.'):
    # skip .git and node_modules
    if any(ignore in root for ignore in ['.git', 'node_modules', '.gemini']):
        continue
    for f in files:
        path = os.path.join(root, f)
        if any(f.endswith(ext) for ext in ['.html', '.css', '.js', '.py', '.json']):
            try:
                with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                    content = fp.read()
                    for line_no, line in enumerate(content.splitlines(), 1):
                        lower = line.lower()
                        if 'logo' in lower or 'iconplus' in lower or 'icon+' in lower or 'brand' in lower:
                            print(f"{path}:{line_no} -> {line.strip()[:120]}")
            except Exception as e:
                pass
