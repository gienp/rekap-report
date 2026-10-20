import sqlite3
import json

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

print('=== COLLO STATUS COUNTS in telecom_portal.db ===')
for r in c.execute('SELECT status, COUNT(*) FROM collo_records GROUP BY status').fetchall():
    print(r)

print('\n=== TOTAL COLLO ROWS ===')
print(c.execute('SELECT COUNT(*) FROM collo_records').fetchone()[0])

print('\n=== EXACT STATUS VALUES in collo_records ===')
for r in c.execute('SELECT DISTINCT status, COUNT(*) FROM collo_records GROUP BY status').fetchall():
    print(r)

print('\n=== BACKUP DATABASES CHECK ===')
import os
for f in os.listdir('.'):
    if f.endswith('.db'):
        print('DB File:', f)
        try:
            c2 = sqlite3.connect(f).cursor()
            for r in c2.execute('SELECT status, COUNT(*) FROM collo_records GROUP BY status').fetchall():
                print('  ', f, r)
        except Exception as e:
            print('  error:', e)
