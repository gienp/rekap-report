import sqlite3

c = sqlite3.connect('telecom_portal.db').cursor()
active = c.execute("SELECT COUNT(*) FROM collo_records WHERE status = 'ACTIVE'").fetchone()[0]
deact = c.execute("SELECT COUNT(*) FROM collo_records WHERE status = 'DEACTIVASI'").fetchone()[0]
non_act = c.execute("SELECT COUNT(*) FROM collo_records WHERE status = 'NON ACTIVE'").fetchone()[0]
print(f"ACTIVE: {active}")
print(f"DEACTIVASI: {deact}")
print(f"ACTIVE + DEACTIVASI: {active + deact}")
print(f"NON ACTIVE: {non_act}")
print(f"TOTAL: {active + deact + non_act}")

c_backup = sqlite3.connect('telecom_portal_backup_before_dedup.db').cursor()
b_active = c_backup.execute("SELECT COUNT(*) FROM collo_records WHERE status = 'ACTIVE'").fetchone()[0]
b_deact = c_backup.execute("SELECT COUNT(*) FROM collo_records WHERE status = 'DEACTIVASI'").fetchone()[0]
b_non = c_backup.execute("SELECT COUNT(*) FROM collo_records WHERE status = 'NON ACTIVE'").fetchone()[0]
print("\n--- IN BACKUP BEFORE DEDUP ---")
print(f"Backup ACTIVE: {b_active}")
print(f"Backup DEACTIVASI: {b_deact}")
print(f"Backup NON ACTIVE: {b_non}")
print(f"Backup TOTAL: {b_active + b_deact + b_non}")

c_net = sqlite3.connect('network_infrastructure.db').cursor()
n_active = c_net.execute("SELECT COUNT(*) FROM collo_records WHERE status = 'ACTIVE'").fetchone()[0]
n_deact = c_net.execute("SELECT COUNT(*) FROM collo_records WHERE status = 'DEACTIVASI'").fetchone()[0]
n_non = c_net.execute("SELECT COUNT(*) FROM collo_records WHERE status = 'NON ACTIVE'").fetchone()[0]
print("\n--- IN ORIGINAL network_infrastructure.db (from Excel Raw Data) ---")
print(f"Network ACTIVE: {n_active}")
print(f"Network DEACTIVASI: {n_deact}")
print(f"Network NON ACTIVE: {n_non}")
print(f"Network TOTAL: {n_active + n_deact + n_non}")
