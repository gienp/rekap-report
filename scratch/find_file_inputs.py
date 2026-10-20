with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.findall(r'<input[^>]+type=[\'"]file[\'"][^>]*>', text)
print("File inputs in index.html:")
for m in matches:
    print(" ", m)

with open('app.js', 'r', encoding='utf-8') as f:
    js_text = f.read()

matches_js = re.findall(r'type=[\'"]file[\'"]', js_text)
print(f"File input occurrences in app.js: {len(matches_js)}")

# Find modals or photo upload handlers in app.js
for m in re.finditer(r'foto_bukti|quickEdit|openQuickEditModal', js_text):
    start = max(0, m.start() - 50)
    end = min(len(js_text), m.end() + 100)
    # print sample
