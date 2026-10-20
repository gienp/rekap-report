import json
from collections import Counter

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

counts = Counter(r.get('pengelola') for r in data['collo_records'] if r.get('pengelola'))

pairs = [
    ('DCI Indonesia', 'DCI INDONESIA'),
    ('Mora Telematika Indonesia', 'MORA TELEMATIKA INDONESIA'),
    ('PT Rekajasa Akses', 'PT REKAJASA AKSES'),
    ('Envision', 'ENVISION'),
    ('BIT Teknologi Nusantara', 'Bit Teknologi Nusantara'),
    ('Ekagrata Data Gemilang', 'EKagrata Data Gemilang'),
    ('Asosiasi Penyelenggara Jasa Internet Indonesia (APJII)', 'Asosiasi penyelenggara Jasa Internet Indonesia (APJII)'),
    ('Internetwork Komunikasi Indonesia', 'Internetwork Komunikasi indonesia'),
    ('Kawasan Berikat Nusantara', 'Kawasan berikat Nusantara'),
    ('Plaza Adika Lestari', 'Plaza adika lestari'),
    ('Smartfren Telecom Tbk', 'Smartfren Telecom TBK'),
    ('Biznet Data Center,PT', 'Biznet Data center,PT'),
    ('Sigma Cipta Caraka, PT', 'SIGMA CIPTA CARAKA, PT'),
    ('Sigma Cipta Caraka,PT', 'Sigma cipta caraka,PT'),
    ('Teknovatus Solusi Sejahtera,PT', 'Teknovatus solusi sejahtera,PT')
]

for p1, p2 in pairs:
    print(f"'{p1}': {counts.get(p1, 0)}  vs  '{p2}': {counts.get(p2, 0)}")
