import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()

c.execute("SELECT id, pengelola, pelanggan, no_so, terminating FROM collo_records WHERE pengelola LIKE '%caltumas%' OR pengelola LIKE '%caturmas%'")
rows = c.fetchall()
print("Found rows for Caltumas / Caturmas:")
for r in rows:
    print(r)

# Check all distinct pengelola
c.execute("SELECT DISTINCT pengelola FROM collo_records ORDER BY pengelola")
all_p = [r[0] for r in c.fetchall()]
print(f"\nTotal distinct pengelola: {len(all_p)}")

# Find possible near duplicates (differing by case, small edit distance, or similar words)
import difflib
near_dupes = []
for i in range(len(all_p)):
    for j in range(i + 1, len(all_p)):
        p1, p2 = all_p[i], all_p[j]
        # check similarity ratio
        ratio = difflib.SequenceMatcher(None, p1.lower(), p2.lower()).ratio()
        if ratio > 0.8 and p1.lower() != p2.lower():
            near_dupes.append((p1, p2, ratio))

print(f"\nNear duplicate pairs (ratio > 0.8): {len(near_dupes)}")
for p1, p2, r in near_dupes:
    print(f"  {r:.2f}: '{p1}' vs '{p2}'")
