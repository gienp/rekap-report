import sqlite3

conn = sqlite3.connect('telecom_portal.db')
c = conn.cursor()
c.execute("SELECT DISTINCT pengelola FROM collo_records ORDER BY pengelola")
all_p = [r[0] for r in c.fetchall()]

# Let's check all words and see if any word occurs with edit distance 1 or 2
from collections import defaultdict
import re

print("All 258 distinct pengelola:")
for i, p in enumerate(all_p, 1):
    print(f"{i:3d}. {p}")
