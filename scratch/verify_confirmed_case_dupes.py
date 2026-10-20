import json
import re

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

collo_map = {r['id']: r for r in data['collo_records']}

# Define all confirmed duplicate pairs/groups based on the user's rule:
# (master_id, [superseded_ids], name_notes)
confirmed_case_dupes = [
    # 1. User screenshot: Supra Primatama / Biznet Technocenter Surabaya (ID 1314 vs ID 1964)
    (1964, [1314], "PT Supra Primatama Nusantara - Biznet Technocenter Surabaya (A821204000046)"),
    
    # 2. Bukalapak (ID 963 vs ID 2042)
    (2042, [963], "PT Bukalapak.com Tbk - Jl. Dr. Wahidin Raya No.1"),
    
    # 3. Goto / Tokopedia (ID 1010 vs ID 3057)
    (3057, [1010], "PT Goto (Gojek Tokopedia) - Pasaraya Blok M (A821303001181)"),
    
    # 4. Garuda Nusantara Steel (ID 2246 vs ID 3083)
    (3083, [2246], "PT Garuda Nusantara Steel - Marunda Center (PA/ACT/2303/1608)"),
    
    # 5. Softex Indonesia (ID 2276 vs ID 3099)
    (3099, [2276], "PT Softex Indonesia - Trembersi Tower (A111303005863)"),
    
    # 6. GH EMM Indonesia (ID 2656 vs ID 3053)
    (3053, [2656], "PT GH-EMM Indonesia - APL Tower 39th fl (PA/UPG/2001/0203)"),
    
    # 7. Pertamina Gas Krakatau (ID 1840 vs ID 2606)
    (2606, [1840], "PT PERTAMINA GAS - Jl. Amerika I Cilegon (01000362396)"),
    
    # 8. Mattel Indonesia (ID 2098 vs ID 2374)
    (2374, [2098], "PT MATTEL INDONESIA - Pemindahan Jalur Direct (111303013881)"),
    
    # 9. Telkomsel / Telkom Internasional (ID 2739 vs ID 2921)
    (2921, [2739], "PT Telekomunikasi Indonesia Int - DCI Cibitung (A111202007568)"),
    
    # 10. BCA Finance (ID 2964 vs ID 2877)
    (2877, [2964], "BCA Finance - BCAF Bekasi Jl. Harapan Indah"),
    
    # 11. Nosairis DCI JK1 (ID 2906 vs ID 2936)
    (2936, [2906], "PT Nosairis Teknologi Solutions - DCI JK1 Cibitung"),
    
    # 12. Indomarco Prismatama Tower (ID 3080 vs ID 3077)
    (3077, [3080], "PT Indomarco Prismatama - Indomaret Tower Kamal Muara")
]

print(f"Total confirmed case-variation groups to consolidate: {len(confirmed_case_dupes)}")
for m_id, sups, desc in confirmed_case_dupes:
    m = collo_map.get(m_id)
    print(f"\n[Master ID {m_id}]: {desc}")
    print(f"  Master: Pel='{m.get('pelanggan')}' | SO='{m.get('no_so')}' | Dates={m.get('start_date')} to {m.get('end_date')} | Rev={m.get('rev_sewa_tahun'):,}")
    for s_id in sups:
        s = collo_map.get(s_id)
        print(f"  Superseded ID {s_id}: Pel='{s.get('pelanggan')}' | SO='{s.get('no_so')}' | Dates={s.get('start_date')} to {s.get('end_date')} | Rev={s.get('rev_sewa_tahun'):,}")
