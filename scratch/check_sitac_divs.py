with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

start_marker = 'id="view-sitac-pa"'
start_idx = text.find(start_marker)
end_idx = text.find('</section>', start_idx)
sub = text[start_idx:end_idx]

import re
div_opens = len(re.findall(r'<div[\s>]', sub))
div_closes = len(re.findall(r'</div>', sub))
print(f'Div opens: {div_opens}, Div closes: {div_closes}, Difference: {div_opens - div_closes}')

# Check lines
lines = sub.split('\n')
depth = 0
for i, line in enumerate(lines, 1):
    opens = len(re.findall(r'<div[\s>]', line))
    closes = len(re.findall(r'</div>', line))
    depth += opens - closes
    if 'sitacRegionalFilterCard' in line:
        print(f'Line {i}: sitacRegionalFilterCard -> depth = {depth}')
    if 'filter-toolbar-card' in line:
        print(f'Line {i}: filter-toolbar-card -> depth = {depth}')
    if 'sitacTableCard' in line:
        print(f'Line {i}: sitacTableCard -> depth = {depth}')
print(f'Final depth inside view-sitac-pa: {depth}')
