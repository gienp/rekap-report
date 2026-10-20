import json
import sqlite3

# Load JSON data
with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

collo_list = data['collo_records']
collo_map = {r['id']: r for r in collo_list}

# Consolidation pairs/groups: (master_id, [superseded_ids], term_override)
consolidations = [
    # 1. User screenshot: Supra Primatama / Biznet Surabaya (Row 1 vs Row 2)
    (1964, [1314], None),
    
    # 2. Bukalapak (ALL CAPS vs Title Case)
    (2042, [963], None),
    
    # 3. Goto / Tokopedia - Pasaraya Blok M
    (3057, [1010], None),
    
    # 4. Garuda Nusantara Steel - Marunda Center ("PT" prefix)
    (3083, [2246], None),
    
    # 5. Softex Indonesia - Trembersi Tower ("PT" prefix, ALL CAPS vs Title Case)
    (3099, [2276], None),
    
    # 6. GH EMM Indonesia - APL Tower (GH-EMM vs GH EMM)
    (3053, [2656], None),
    
    # 7. Pertamina Gas - Jl. Amerika I Cilegon ("PT", ALL CAPS vs Title Case)
    (2606, [1840], None),
    
    # 8. Mattel Indonesia - Jalur Direct (ALL CAPS vs lowercase in terminating)
    (2374, [2098], None),
    
    # 9. Pelindo II / Taruna Bina Sarana & AKR (Spacing, ALL CAPS vs Title Case)
    (2181, [2086], None),
    
    # 10. Serpong Mas Telematika / Nippon Konpo (Nippon vs Nippo, ALL CAPS vs Title Case)
    (2803, [2186], None),
    
    # 11. PC24 Telekomunikasi / Bank Sinarmas Deltamas (PC24 vs PC 24)
    (3078, [2257], None),
    
    # 12. Telkom / Prodia Gunung Putri (ALL CAPS vs Title Case)
    (3049, [2306], None),
    
    # 13. Netciti / Primacom Interbuana (ALL CAPS vs Title Case)
    (3114, [1759], None),
    
    # 14. Netciti / Bank Mandiri Tangerang (ALL CAPS vs Title Case)
    (3122, [1771], None),
    
    # 15. Detik Ini Juga / Trans Rekreasindo Surabaya ("PT" prefix)
    (3104, [2660], None),
    
    # 16. Mega Akses Persada / Indomarco Prismatama ("PT" prefix)
    (3077, [2663], None),
    
    # 17. Multitech Infomedia / Jaringanku Sarana Nusantara (Typo: Jariganku vs Jaringanku)
    (2319, [2044], None)
]

all_modified = []
modified_ids = set()

for master_id, sup_ids, term_override in consolidations:
    master = collo_map[master_id]
    if term_override:
        master['terminating'] = term_override
        
    for s_id in sup_ids:
        s = collo_map[s_id]
        
        # Merge missing fields to master
        if not master.get('originating') and s.get('originating'):
            master['originating'] = s['originating']
        if not master.get('terminating') and s.get('terminating'):
            master['terminating'] = s['terminating']
        if not master.get('sid') and s.get('sid'):
            master['sid'] = s['sid']
        if not master.get('no_so') and s.get('no_so'):
            master['no_so'] = s['no_so']
            
        # Merge PO / SPP references
        s_po = s.get('po_baru') or ''
        s_spp = s.get('spp') or ''
        s_start = s.get('start_date') or ''
        s_end = s.get('end_date') or ''
        cur_ref = master.get('ref_spp') or ''
        
        ref_entry = f"PO: {s_po}" if s_po else ""
        if s_spp:
            ref_entry += f" ({s_spp})"
        if s_start and s_end:
            ref_entry += f" [{s_start} sd {s_end}]"
            
        if ref_entry and ref_entry not in cur_ref:
            master['ref_spp'] = (cur_ref + " | " + ref_entry).strip(" |")
            
        # Merge keterangan
        s_ket = s.get('keterangan') or ''
        cur_ket = master.get('keterangan') or ''
        if s_ket and s_ket not in cur_ket:
            master['keterangan'] = (cur_ket + " | " + s_ket).strip(" |")
            
        # Mark superseded
        s['status'] = 'NON ACTIVE'
        s['is_active'] = 0
        s['alert_category'] = 'SUPERSEDED'
        s['alert_label'] = 'Tergabung (Superseded)'
        s['alert_color'] = 'slate'
        s_prev_ket = s.get('keterangan') or ''
        if not s_prev_ket.startswith(f"[Tergabung ke ID {master_id}]"):
            s['keterangan'] = f"[Tergabung ke ID {master_id}] " + s_prev_ket
            
        if s['id'] not in modified_ids:
            all_modified.append(s)
            modified_ids.add(s['id'])
            
    if master['id'] not in modified_ids:
        all_modified.append(master)
        modified_ids.add(master['id'])

print(f"Consolidated {len(consolidations)} case-variation groups! Total affected records: {len(all_modified)}")

# Save to sitac_collo_data.json
with open('sitac_collo_data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("Saved sitac_collo_data.json successfully")

# Save to sitac_collo_data.js
with open('sitac_collo_data.js', 'w', encoding='utf-8') as f:
    f.write('window.SITAC_COLLO_DATA = ' + json.dumps(data, ensure_ascii=False) + ';\n')
print("Saved sitac_collo_data.js successfully")

# Update SQLite telecom_portal.db
conn = sqlite3.connect('telecom_portal.db')
cursor = conn.cursor()
for r in all_modified:
    cursor.execute("""
        UPDATE collo_records
        SET status = ?, is_active = ?, alert_category = ?, alert_label = ?, alert_color = ?,
            originating = ?, terminating = ?, no_so = ?, sid = ?, ref_spp = ?, keterangan = ?
        WHERE id = ?
    """, (
        r.get('status'),
        r.get('is_active', 1),
        r.get('alert_category'),
        r.get('alert_label'),
        r.get('alert_color'),
        r.get('originating'),
        r.get('terminating'),
        r.get('no_so'),
        r.get('sid'),
        r.get('ref_spp'),
        r.get('keterangan'),
        r['id']
    ))
conn.commit()
conn.close()
print("Updated telecom_portal.db successfully")

# Save modified records for Firestore upload
with open('scratch/modified_case_collo.json', 'w', encoding='utf-8') as f:
    json.dump(all_modified, f, ensure_ascii=False, indent=2)
print("Saved scratch/modified_case_collo.json successfully")
