from scan_case_variations import potential_dupes

print("=== CANDIDATES 1 to 10 ===")
for idx, (r1, r2, reason) in enumerate(potential_dupes[:10], start=1):
    print(f"\n[{idx}] Peng: {r1.get('pengelola')} | Reason: {reason}")
    print(f"  R1 (ID {r1['id']}): Pel={r1.get('pelanggan')[:30]} | SO={r1.get('no_so')} | Term={r1.get('terminating')[:30]} | Dates={r1.get('start_date')} to {r1.get('end_date')} | Rev={r1.get('rev_sewa_tahun')}")
    print(f"  R2 (ID {r2['id']}): Pel={r2.get('pelanggan')[:30]} | SO={r2.get('no_so')} | Term={r2.get('terminating')[:30]} | Dates={r2.get('start_date')} to {r2.get('end_date')} | Rev={r2.get('rev_sewa_tahun')}")
