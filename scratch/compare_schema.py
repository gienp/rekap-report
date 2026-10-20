import sqlite3

c1 = sqlite3.connect('telecom_portal.db').cursor()
c2 = sqlite3.connect('telecom_portal_backup_before_dedup.db').cursor()

cols1 = [r[1] for r in c1.execute("PRAGMA table_info(collo_records)").fetchall()]
cols2 = [r[1] for r in c2.execute("PRAGMA table_info(collo_records)").fetchall()]

print("telecom_portal.db columns in collo_records:")
print(cols1)
print("\ntelecom_portal_backup_before_dedup.db columns in collo_records:")
print(cols2)
print("\nColumns difference:", set(cols1) ^ set(cols2))
