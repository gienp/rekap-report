import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

users = [
    {'username': 'harlan', 'full_name': 'Harlan Zaelani', 'pic_code': 'Harlan'},
    {'username': 'budi', 'full_name': 'Budi Rodiyah', 'pic_code': 'Budi'},
    {'username': 'edi', 'full_name': 'Edi Swargaloka', 'pic_code': 'Edi'},
    {'username': 'abusopian', 'full_name': 'M. Abusopian', 'pic_code': 'Abusopian'},
    {'username': 'muhidin', 'full_name': 'Muhidin', 'pic_code': 'Muhidin'},
    {'username': 'brian', 'full_name': 'Brian Ariyanto', 'pic_code': 'Brian'},
    {'username': 'zulhadi', 'full_name': 'Zulhadi Syahril', 'pic_code': 'Zulhadi'}
]

def is_assigned(rec, u):
    pic_field = (rec.get('pic_perijinan') or '').lower().strip()
    if not pic_field: return False
    tokens = [u['username'].lower(), u['pic_code'].lower(), u['full_name'].lower()]
    for p in u['full_name'].lower().split():
        if len(p) >= 3 and p not in ('dan', 'tim', 'all'):
            tokens.append(p)
    norm = pic_field.replace('.', ' ').replace('-', ' ').replace('_', ' ')
    return any(t in pic_field or t in norm for t in tokens)

print('=== SITAC MATCHES ===')
sitac = data.get('sitac_records', [])
total_sitac_matched = 0
for u in users:
    matched = [s for s in sitac if is_assigned(s, u)]
    total_sitac_matched += len(matched)
    print(f"{u['username']} ({u['pic_code']}): {len(matched)} PA")
print(f"Total SITAC matched: {total_sitac_matched} / {len(sitac)}")

print('\n=== GANGGUAN MATCHES ===')
gangguan = data.get('gangguan_records', [])
total_g_matched = 0
for u in users:
    matched = [g for g in gangguan if is_assigned(g, u)]
    total_g_matched += len(matched)
    print(f"{u['username']} ({u['pic_code']}): {len(matched)} Tiket")
print(f"Total Gangguan matched: {total_g_matched} / {len(gangguan)}")
