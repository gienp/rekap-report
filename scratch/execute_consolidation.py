import json
import sqlite3
from collections import defaultdict

def norm(s):
    return (s or '').strip().lower()

def norm_loc(s):
    s = norm(s)
    return ''.join(c for c in s if c.isalnum())[:35]

# 1. Load JSON data
with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

collo_list = data['collo_records']
collo_map = {r['id']: r for r in collo_list}
active = [r for r in collo_list if r.get('status') == 'ACTIVE']

groups = defaultdict(list)

# Pass 1: SO + LOC
for r in active:
    so = norm(r.get('no_so'))
    loc = norm_loc(r.get('terminating'))
    peng = norm(r.get('pengelola'))
    pel = norm(r.get('pelanggan'))
    if so and len(so) > 3 and loc:
        groups[('SO+LOC', peng, pel, so, loc)].append(r)

# Pass 2: SID + LOC
for r in active:
    so = norm(r.get('no_so'))
    loc = norm_loc(r.get('terminating'))
    sid = norm(r.get('sid'))
    peng = norm(r.get('pengelola'))
    pel = norm(r.get('pelanggan'))
    if (not so or len(so) <= 3) and sid and len(sid) > 3 and loc:
        groups[('SID+LOC', peng, pel, sid, loc)].append(r)

# Pass 3: SO only
for r in active:
    so = norm(r.get('no_so'))
    loc = norm_loc(r.get('terminating'))
    peng = norm(r.get('pengelola'))
    pel = norm(r.get('pelanggan'))
    if so and len(so) > 3 and not loc:
        groups[('SO_ONLY', peng, pel, so)].append(r)

# Pass 4: SID only
for r in active:
    so = norm(r.get('no_so'))
    sid = norm(r.get('sid'))
    loc = norm_loc(r.get('terminating'))
    peng = norm(r.get('pengelola'))
    pel = norm(r.get('pelanggan'))
    if (not so or len(so) <= 3) and sid and len(sid) > 3 and not loc:
        groups[('SID_ONLY', peng, pel, sid)].append(r)

# Pass 5: LOC + REV
for r in active:
    so = norm(r.get('no_so'))
    sid = norm(r.get('sid'))
    loc = norm_loc(r.get('terminating'))
    peng = norm(r.get('pengelola'))
    pel = norm(r.get('pelanggan'))
    rev = r.get('rev_sewa_tahun', 0)
    if (not so or len(so) <= 3) and (not sid or len(sid) <= 3) and loc and len(loc) > 15:
        groups[('LOC+REV', peng, pel, loc, rev)].append(r)

dupe_groups = {k: v for k, v in groups.items() if len(v) > 1}
print(f"Total duplicate groups to consolidate: {len(dupe_groups)}")

consolidated_count = 0
superseded_count = 0

for k, recs in dupe_groups.items():
    # Sort: latest end_date first, then highest ID
    sorted_recs = sorted(recs, key=lambda r: (r.get('end_date') or '', r.get('id') or 0), reverse=True)
    master = sorted_recs[0]
    superseded_list = sorted_recs[1:]
    
    # 1. Enhance master
    # Borrow empty fields
    for s in superseded_list:
        if not master.get('originating') and s.get('originating'):
            master['originating'] = s['originating']
        if not master.get('alamat_pengelola') and s.get('alamat_pengelola'):
            master['alamat_pengelola'] = s['alamat_pengelola']
        if not master.get('pic_admin') and s.get('pic_admin'):
            master['pic_admin'] = s['pic_admin']
        if not master.get('pic_rekanan') and s.get('pic_rekanan'):
            master['pic_rekanan'] = s['pic_rekanan']
        if not master.get('telp') and s.get('telp'):
            master['telp'] = s['telp']

    # Consolidate historical POs / SPPs
    history_refs = []
    for s in superseded_list:
        s_po = s.get('po_baru') or ''
        s_spp = s.get('spp') or ''
        s_ref = s.get('ref_spp') or ''
        s_start = s.get('start_date') or ''
        s_end = s.get('end_date') or ''
        if s_ref and s_ref.lower() != 'baru' and s_ref not in master.get('ref_spp', ''):
            history_refs.append(s_ref)
        if s_po and s_po != master.get('po_baru'):
            desc = f"PO Sebelumnya: {s_po}"
            if s_spp:
                desc += f" (SPP: {s_spp})"
            if s_start and s_end:
                desc += f" [{s_start} sd {s_end}]"
            history_refs.append(desc)
            
    if history_refs:
        cur_ref = master.get('ref_spp') or ''
        if cur_ref.lower() == 'baru' or not cur_ref:
            master['ref_spp'] = ' | '.join(dict.fromkeys(history_refs))
        else:
            all_refs = [cur_ref] + [r for r in history_refs if r not in cur_ref]
            master['ref_spp'] = ' | '.join(dict.fromkeys(all_refs))

    # Combine keterangan
    ket_additions = []
    master_ket = master.get('keterangan') or ''
    for s in superseded_list:
        s_ket = s.get('keterangan') or ''
        if s_ket and s_ket not in master_ket:
            ket_additions.append(s_ket)
    if ket_additions:
        if master_ket:
            master['keterangan'] = master_ket + ' | ' + ' | '.join(dict.fromkeys(ket_additions))
        else:
            master['keterangan'] = ' | '.join(dict.fromkeys(ket_additions))

    # 2. Mark superseded
    for s in superseded_list:
        s['status'] = 'NON ACTIVE'
        s['is_active'] = 0
        s['alert_category'] = 'SUPERSEDED'
        s['alert_label'] = 'Tergabung (Superseded)'
        s['alert_color'] = 'slate'
        prev_ket = s.get('keterangan') or ''
        if not prev_ket.startswith(f"[Tergabung ke ID {master['id']}]"):
            s['keterangan'] = f"[Tergabung ke ID {master['id']}] " + prev_ket
        superseded_count += 1
    
    consolidated_count += 1

print(f"Consolidation complete: {consolidated_count} masters updated, {superseded_count} superseded records updated.")

# 3. Update summary metrics in data
active_remaining = [r for r in collo_list if r.get('status') == 'ACTIVE']
print(f"Remaining active collo records: {len(active_remaining)}")

# 4. Save to sitac_collo_data.json
with open('sitac_collo_data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("Saved to sitac_collo_data.json")

# 5. Save to sitac_collo_data.js
with open('sitac_collo_data.js', 'w', encoding='utf-8') as f:
    f.write('window.SITAC_COLLO_DATA = ' + json.dumps(data, ensure_ascii=False) + ';\n')
print("Saved to sitac_collo_data.js")

# 6. Update SQLite database
conn = sqlite3.connect('telecom_portal.db')
cursor = conn.cursor()

# Update all records in collo_records
for r in collo_list:
    cursor.execute("""
        UPDATE collo_records
        SET status = ?, is_active = ?, alert_category = ?, alert_label = ?, alert_color = ?,
            originating = ?, alamat_pengelola = ?, ref_spp = ?, keterangan = ?,
            pic_admin = ?, pic_rekanan = ?, telp = ?
        WHERE id = ?
    """, (
        r.get('status'),
        r.get('is_active', 1),
        r.get('alert_category'),
        r.get('alert_label'),
        r.get('alert_color'),
        r.get('originating'),
        r.get('alamat_pengelola'),
        r.get('ref_spp'),
        r.get('keterangan'),
        r.get('pic_admin'),
        r.get('pic_rekanan'),
        r.get('telp'),
        r['id']
    ))

conn.commit()
conn.close()
print("Updated SQLite database telecom_portal.db")

# 7. Check ID 828 and 866
print("\n--- Verification of ID 828 & 866 ---")
print("ID 828 (Superseded):", {k: collo_map[828][k] for k in ['id', 'status', 'is_active', 'alert_category', 'alert_label', 'keterangan']})
print("ID 866 (Master):", {k: collo_map[866][k] for k in ['id', 'status', 'originating', 'ref_spp', 'keterangan']})
