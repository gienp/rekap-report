import json
import sqlite3

# Load JSON
with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

collo_list = data['collo_records']
collo_map = {r['id']: r for r in collo_list}

# Consolidation pairs/groups: (master_id, [superseded_ids], new_terminating_override)
consolidations = [
    # 1. Jekael Invesco (The user's screenshot! Row 1 and Row 2)
    (3073, [3072], "Menara Jamsostek Lt 12b/13 & Lt 19 Selatan"),
    
    # 2. PT Patra Jasa - Landmark
    (2828, [2827], None),
    
    # 3. PT Patra Jasa - Pertamina (Rev 562.8M)
    (2830, [2829], None),
    
    # 4. PT Patra Jasa - Pertamina (Rev 756M)
    (2832, [2831], None),
    
    # 5. Kantor Taman A9 - Pasifik Satelit (Rev 73.32M)
    (2204, [2198, 2201], "Kantor Taman A9"),
    
    # 6. Kantor Taman A9 - Pasifik Satelit (Rev 85.8M)
    (2203, [2200], "Kantor Taman A9"),
    
    # 7. Karyagraha Nusantara - IPWAN Global
    (1220, [1218], None),
    
    # 8. ICT - Hipernet (Nippon Indosari)
    (1107, [1104], "PT. Nippon Indosari Corpindo Jababeka 5 & Kawasan Industri"),
    
    # 9. PT Kurnadi Abadi - Kemenkominfo
    (2648, [2647], None),
    
    # 10. ICT - PT Jaya Refrigeration
    (2787, [2726], "Kawasan Industri Jababeka & Jl. Jababeka Raya Q No.1"),
    
    # 11. Aplikanusa Lintasarta - Softex Indonesia
    (3099, [2835], None),
    
    # 12. Cyberindo Aditama - Bank Mandiri
    (3079, [2661], None),
    
    # 13. APJII - Mora Telematika
    (2934, [2691], None),
    
    # 14. CBN Nusantara - Klik Indomaret
    (2983, [2982], None),
    
    # 15. Kawasan Berikat Nusantara - Sari Dumai Oleo
    (2836, [2837], "Jl. Fak-Fak No. 6 & Jl. Semarang BI A-6 Marunda"),
    
    # 16. NTT Indonesia - Nosairis
    (2993, [2867], "DCI JK1 Cibitung & NTT Cyber 3"),
    
    # 17. PCDC Propco One - Bank Danamon
    (2994, [2917], "DC DMG BDDC & Backhaul DC BDDC Atria"),
    
    # 18. IKI - Pertamina Gas Starlink
    (2902, [2899, 2900, 2901], "Starlink Booster Sites (Manggala, Kota Batak, Batang, Batak Jct)")
]

all_modified = []

for master_id, sup_ids, term_override in consolidations:
    master = collo_map[master_id]
    if term_override:
        master['terminating'] = term_override
        
    for s_id in sup_ids:
        s = collo_map[s_id]
        
        # Merge info to master
        if not master.get('originating') and s.get('originating'):
            master['originating'] = s['originating']
            
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
            
        all_modified.append(s)
    all_modified.append(master)

print(f"Consolidated {len(consolidations)} groups! Total affected records: {len(all_modified)}")

# Save to sitac_collo_data.json
with open('sitac_collo_data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("Saved sitac_collo_data.json")

# Save to sitac_collo_data.js
with open('sitac_collo_data.js', 'w', encoding='utf-8') as f:
    f.write('window.SITAC_COLLO_DATA = ' + json.dumps(data, ensure_ascii=False) + ';\n')
print("Saved sitac_collo_data.js")

# Update SQLite
conn = sqlite3.connect('telecom_portal.db')
cursor = conn.cursor()
for r in all_modified:
    cursor.execute("""
        UPDATE collo_records
        SET status = ?, is_active = ?, alert_category = ?, alert_label = ?, alert_color = ?,
            originating = ?, terminating = ?, ref_spp = ?, keterangan = ?
        WHERE id = ?
    """, (
        r.get('status'),
        r.get('is_active', 1),
        r.get('alert_category'),
        r.get('alert_label'),
        r.get('alert_color'),
        r.get('originating'),
        r.get('terminating'),
        r.get('ref_spp'),
        r.get('keterangan'),
        r['id']
    ))
conn.commit()
conn.close()
print("Updated telecom_portal.db")

# Save modified records for Firestore upload
with open('scratch/modified_price_collo.json', 'w', encoding='utf-8') as f:
    json.dump(all_modified, f, ensure_ascii=False, indent=2)
print("Saved scratch/modified_price_collo.json")
