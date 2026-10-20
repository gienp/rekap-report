import json

log_path = r'C:\Users\anggi\.gemini\antigravity-ide\brain\e05d1ede-d3ec-46bd-b263-9f3ba08cffea\.system_generated\logs\transcript_full.jsonl'
with open(log_path, 'r', encoding='utf-8') as f, open('scratch/dialog_5550_5600.txt', 'w', encoding='utf-8') as out:
    for line in f:
        data = json.loads(line)
        idx = data.get('step_index', 0)
        if idx >= 5560 and idx <= 5585:
            out.write(f"--- STEP {idx} [{data.get('type')}] ---\n")
            c = data.get('content')
            if c:
                out.write(str(c)[:1500] + "\n")
