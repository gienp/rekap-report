import sqlite3

c_dedup = sqlite3.connect('telecom_portal_backup_before_dedup.db').cursor()
c_cur = sqlite3.connect('telecom_portal.db').cursor()

# Get all 860 active records from backup
b_active = c_dedup.execute("SELECT id, pengelola, pelanggan, no_so, sid, originating, terminating, rev_sewa_tahun, biaya_sewa_tahun FROM collo_records WHERE status = 'ACTIVE'").fetchall()
cur_ids = set(r[0] for r in c_cur.execute("SELECT id FROM collo_records").fetchall())

deleted = [r for r in b_active if r[0] not in cur_ids]
print(f"Total deleted ACTIVE records: {len(deleted)}")

# Group deleted records by why they were considered duplicates:
# Look up remaining records in current db that have the same SO or SID or location
matched_to_master = []
no_match = []

for r in deleted:
    rid, pengelola, pelanggan, no_so, sid, orig, term, rev, biaya = r
    # Check if a record with same no_so exists in current db
    found = None
    if no_so and no_so.strip():
        m = c_cur.execute("SELECT id, pengelola, pelanggan, no_so, sid, rev_sewa_tahun, status FROM collo_records WHERE TRIM(no_so) = ? AND TRIM(pengelola) = ?", (no_so.strip(), pengelola.strip())).fetchall()
        if m:
            found = ('SAME_SO', m)
    if not found and sid and sid.strip():
        m = c_cur.execute("SELECT id, pengelola, pelanggan, no_so, sid, rev_sewa_tahun, status FROM collo_records WHERE TRIM(sid) = ? AND TRIM(pengelola) = ?", (sid.strip(), pengelola.strip())).fetchall()
        if m:
            found = ('SAME_SID', m)
    if not found and term and term.strip():
        m = c_cur.execute("SELECT id, pengelola, pelanggan, originating, terminating, rev_sewa_tahun, status FROM collo_records WHERE TRIM(terminating) = ? AND TRIM(pengelola) = ?", (term.strip(), pengelola.strip())).fetchall()
        if m:
            found = ('SAME_TERM', m)
            
    if found:
        matched_to_master.append((r, found))
    else:
        no_match.append(r)

print(f"Deleted records matched to existing master in DB: {len(matched_to_master)}")
print(f"Deleted records with NO match in current DB: {len(no_match)}")

print("\nSample 3 matches:")
for d_rec, (match_type, masters) in matched_to_master[:3]:
    print(f"\nDeleted Record (ID {d_rec[0]}): SO={d_rec[3]}, SID={d_rec[4]}, Pengelola={d_rec[1]}, Pelanggan={d_rec[2]}, Rev={d_rec[7]}")
    for m in masters:
        print(f"  -> Kept Master in DB (ID {m[0]}): Status={m[6]}, SO={m[3]}, SID={m[4]}, Rev={m[5]}")

