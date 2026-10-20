import json
import os

known = {
    'budi.rodiyah': 'Budi Rodiyah',
    'edi.swargaloka': 'Edi Swargaloka',
    'harlan.zaelani': 'Harlan Zaelani',
    'zulhadi.syahril': 'Zulhadi Syahril',
    'zulhadi syahril': 'Zulhadi Syahril',
    'muhidin.shelay': 'Muhidin Shelay',
    'brian.ariyanto': 'Brian Ariyanto',
    'agih.gahara': 'Agih Gahara',
    'hairul.aswan': 'Hairul Aswan',
    'yudiansyah': 'Yudiansyah',
    'muhamad abusopian': 'Muhamad Abusopian',
    'muhammad abusopian': 'Muhamad Abusopian'
}

def format_pic_name(name):
    if not name:
        return '-'
    s = str(name).strip()
    if s.lower() in known:
        return known[s.lower()]
    return s

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

sitac_records = data.get('sitac_records', [])
gangguan_records = data.get('gangguan_records', [])

g_map = {}
for g in gangguan_records:
    raw = (g.get('pic_perijinan') or '').strip()
    if raw:
        pic = format_pic_name(raw)
        g_map[pic] = g_map.get(pic, 0) + 1

pic_map = {}
for s in sitac_records:
    raw = (s.get('pic_perijinan') or '').strip()
    if not raw or raw == '-':
        continue
    pic = format_pic_name(raw)
    if pic not in pic_map:
        pic_map[pic] = {
            'pic': pic,
            'total_penugasan': 0,
            'finish': 0,
            'ongoing': 0,
            'hold': 0,
            'cancel': 0,
            'biaya_awal': 0,
            'biaya_final': 0,
            'efisiensi_rupiah': 0,
            'durasi_sum': 0,
            'durasi_count': 0
        }
    e = pic_map[pic]
    e['total_penugasan'] += 1
    prog = (s.get('progress') or '').lower()
    if prog == 'finish': e['finish'] += 1
    elif prog == 'ongoing': e['ongoing'] += 1
    elif prog == 'hold': e['hold'] += 1
    elif prog == 'cancel': e['cancel'] += 1

    e['biaya_awal'] += (s.get('biaya_permintaan_awal') or 0)
    e['biaya_final'] += (s.get('biaya_final') or 0)
    e['efisiensi_rupiah'] += (s.get('efisiensi_rupiah') or 0)
    dh = s.get('durasi_hari')
    if dh is not None and dh >= 0:
        e['durasi_sum'] += dh
        e['durasi_count'] += 1

workload_list = []
for p in sorted(pic_map.values(), key=lambda x: x['total_penugasan'], reverse=True):
    tot = p['total_penugasan']
    fin = p['finish']
    b_awal = p['biaya_awal']
    b_eff = p['efisiensi_rupiah']
    workload_list.append({
        'pic': p['pic'],
        'total_penugasan': tot,
        'finish': fin,
        'ongoing': p['ongoing'],
        'hold': p['hold'],
        'cancel': p['cancel'],
        'finish_rate': round(fin / tot * 100, 1) if tot > 0 else 0.0,
        'biaya_awal': b_awal,
        'biaya_final': p['biaya_final'],
        'efisiensi_rupiah': b_eff,
        'efisiensi_persen': round(b_eff / b_awal * 100, 1) if b_awal > 0 else 0.0,
        'avg_sla_hari': round(p['durasi_sum'] / p['durasi_count'], 1) if p['durasi_count'] > 0 else 0.0,
        'gangguan_count': g_map.get(p['pic'], 0)
    })

print(f"Generated {len(workload_list)} PIC workload records:")
for w in workload_list:
    print(f"  {w['pic']}: {w['total_penugasan']} tugas, {w['finish']} selesai ({w['finish_rate']}%), Rp {w['efisiensi_rupiah']:,} efisiensi")

if 'summary' not in data or not isinstance(data['summary'], dict):
    data['summary'] = {}

data['summary']['workload_performa'] = workload_list
data['workload_performa'] = workload_list

with open('sitac_collo_data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("Updated sitac_collo_data.json successfully.")

with open('sitac_collo_data.js', 'w', encoding='utf-8') as f:
    f.write('window.SITAC_COLLO_DATA = ')
    json.dump(data, f, ensure_ascii=False)
    f.write(';\n')
print("Updated sitac_collo_data.js successfully.")
