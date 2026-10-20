import sqlite3

c_dedup = sqlite3.connect('telecom_portal_backup_before_dedup.db').cursor()
c_cur = sqlite3.connect('telecom_portal.db').cursor()

# Check what happened to the 860 ACTIVE records in backup_before_dedup
b_active_rows = {r[0]: r for r in c_dedup.execute("SELECT id, no_so, sid, pengelola, pelanggan, status, rev_sewa_tahun FROM collo_records WHERE status = 'ACTIVE'").fetchall()}
cur_rows = {r[0]: r for r in c_cur.execute("SELECT id, no_so, sid, pengelola, pelanggan, status, rev_sewa_tahun FROM collo_records").fetchall()}

deleted_from_active = []
status_changed_from_active = {}
still_active = []

for cid, row in b_active_rows.items():
    if cid not in cur_rows:
        deleted_from_active.append(row)
    else:
        cur_status = cur_rows[cid][5]
        if cur_status == 'ACTIVE':
            still_active.append(cid)
        else:
            status_changed_from_active[cur_status] = status_changed_from_active.get(cur_status, 0) + 1

print(f"Total ACTIVE in backup_before_dedup: {len(b_active_rows)}")
print(f"Still ACTIVE in current db: {len(still_active)}")
print(f"Deleted completely from DB: {len(deleted_from_active)}")
print(f"Status changed from ACTIVE to something else: {status_changed_from_active}")

print("\n--- SAMPLE DELETED ACTIVE ROWS ---")
for r in deleted_from_active[:5]:
    print(r)

# Check why they were deleted: were they duplicate SO, SID, or location?
# Let's inspect execute_dedup.py logic on these deleted rows
so_counts = {}
for r in b_active_rows.values():
    so = (r[1] or '').strip()
    if so:
        so_counts[so] = so_counts.get(so, 0) + 1

multi_so_deleted = [r for r in deleted_from_active if (r[1] or '').strip() and so_counts.get((r[1] or '').strip(), 0) > 1]
print(f"\nDeleted rows that had duplicate SO: {len(multi_so_deleted)} out of {len(deleted_from_active)}")
