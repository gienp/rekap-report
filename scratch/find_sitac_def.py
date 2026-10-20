with open('server.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines, 1):
    if 'def handle_get_sitac' in line or 'class TelecomPortalAPIHandler' in line:
        print(f"Line {idx}: {repr(line[:40])}")
