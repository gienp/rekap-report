with open('app.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

import re
print('fetch calls in app.js:')
for m in set(re.findall(r'fetch\(["\']([^"\']+)["\']', text)):
    print(' ', m)

print('\nwindow properties or fallbacks in app.js:')
for m in set(re.findall(r'(window\.[A-Za-z0-9_]+)', text)):
    print(' ', m)
