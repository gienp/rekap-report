import os, re

root = r'c:\Users\anggi\OneDrive\文件\rekap & report'
target = 'bizne data center'

for dirpath, dirnames, filenames in os.walk(root):
    if '.git' in dirpath: continue
    for fn in filenames:
        if fn.endswith(('.js', '.html', '.json', '.py')):
            fp = os.path.join(dirpath, fn)
            try:
                with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if target.lower() in content.lower():
                        print(f"FOUND in {os.path.relpath(fp, root)}")
            except Exception as e:
                pass
