import glob, re

for fpath in ['app.js', 'index.html', 'styles.css']:
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    canvases = re.findall(r'id=["\'](chart\w+)["\']', content, re.IGNORECASE)
    if canvases:
        print(f'{fpath}: {canvases}')
