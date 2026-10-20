with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re

sections = re.findall(r'(<section\b[^>]*>)(.*?)(</section>)', html, re.DOTALL)
print(f'Total sections: {len(sections)}')

for tag, content, end_tag in sections:
    sec_id = re.search(r'id=["\']([^"\']+)["\']', tag)
    sec_id_str = sec_id.group(1) if sec_id else 'unknown'
    opens = len(re.findall(r'<div[\s>]', content))
    closes = len(re.findall(r'</div>', content))
    diff = opens - closes
    print(f'Section {sec_id_str}: opens={opens}, closes={closes}, diff={diff}')
