import sqlite3

def check_diff(db1_name, db2_name):
    c1 = sqlite3.connect(db1_name).cursor()
    c2 = sqlite3.connect(db2_name).cursor()
    
    rows1 = {r[0]: r for r in c1.execute('SELECT id, no_so, sid, pengelola, pelanggan, status, rev_sewa_tahun, biaya_sewa_tahun FROM collo_records').fetchall()}
    rows2 = {r[0]: r for r in c2.execute('SELECT id, no_so, sid, pengelola, pelanggan, status, rev_sewa_tahun, biaya_sewa_tahun FROM collo_records').fetchall()}
    
    deleted_ids = set(rows1.keys()) - set(rows2.keys())
    added_ids = set(rows2.keys()) - set(rows1.keys())
    common_ids = set(rows1.keys()) & set(rows2.keys())
    
    status_changed = []
    for cid in common_ids:
        if rows1[cid][5] != rows2[cid][5]:
            status_changed.append((cid, rows1[cid][3], rows1[cid][4], rows1[cid][5], rows2[cid][5]))
            
    print(f"\n==========================================")
    print(f"Comparing {db1_name} vs {db2_name}")
    print(f"Total in {db1_name}: {len(rows1)}")
    print(f"Total in {db2_name}: {len(rows2)}")
    print(f"Deleted IDs: {len(deleted_ids)}")
    print(f"Added IDs: {len(added_ids)}")
    print(f"Status changed: {len(status_changed)}")
    
    deleted_active = [r for r in rows1.values() if r[0] in deleted_ids and r[5] == 'ACTIVE']
    print(f"Deleted ACTIVE rows: {len(deleted_active)}")
    if deleted_active[:5]:
        print("Sample deleted active rows:")
        for r in deleted_active[:5]:
            print("  ", r)

    if status_changed[:10]:
        print("Sample status changes:")
        for s in status_changed[:10]:
            print("  ", s)

check_diff('telecom_portal_backup_before_dedup.db', 'telecom_portal.db')
check_diff('telecom_portal_backup_before_dedup.db', 'telecom_portal_backup_before_purge_empty_gangguan.db')
check_diff('telecom_portal_backup_before_purge_empty_gangguan.db', 'telecom_portal.db')
