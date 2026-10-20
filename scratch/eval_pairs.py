import json

with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

cmap = {r['id']: r for r in data['collo_records']}

pairs_to_evaluate = [
    (1964, 1314, 'User Screenshot: Supra Primatama - Biznet Surabaya'),
    (2042, 963, 'Bukalapak - Jl Dr Wahidin'),
    (3057, 1010, 'Goto / Tokopedia - Pasaraya Blok M'),
    (3083, 2246, 'Garuda Nusantara Steel - Marunda'),
    (3099, 2276, 'Softex Indonesia - Trembersi Tower'),
    (3053, 2656, 'GH EMM Indonesia - APL Tower'),
    (2606, 1840, 'Pertamina Gas - Jl Amerika I Cilegon'),
    (2374, 2098, 'Mattel Indonesia - Jalur Direct'),
    (2921, 2739, 'Telkom Indonesia Int - DCI Cibitung vs Jatitujuh'),
    (2877, 2964, 'BCA Finance - BCAF Bekasi Harapan Indah'),
    (2936, 2906, 'Nosairis - DCI JK1 Cibitung'),
    (3077, 3080, 'Indomarco Prismatama - Indomaret Tower'),
    (1768, 1765, 'Sumber Alfaria Trijaya - Alam Sutera')
]

for m_id, s_id, label in pairs_to_evaluate:
    m = cmap.get(m_id)
    s = cmap.get(s_id)
    print(f"\n=== {label} ===")
    print(f"  Master ID {m_id}: Pel='{m.get('pelanggan')}' | SO='{m.get('no_so')}' | SID='{m.get('sid')}'")
    print(f"    Term='{m.get('terminating')}' | Dates={m.get('start_date')} to {m.get('end_date')} | Rev={m.get('rev_sewa_tahun'):,} | PO={m.get('po_baru')}")
    print(f"  Supers ID {s_id}: Pel='{s.get('pelanggan')}' | SO='{s.get('no_so')}' | SID='{s.get('sid')}'")
    print(f"    Term='{s.get('terminating')}' | Dates={s.get('start_date')} to {s.get('end_date')} | Rev={s.get('rev_sewa_tahun'):,} | PO={s.get('po_baru')}")
