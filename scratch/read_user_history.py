import json

log_path = r'C:\Users\anggi\.gemini\antigravity-ide\brain\e05d1ede-d3ec-46bd-b263-9f3ba08cffea\.system_generated\logs\transcript.jsonl'
with open(log_path, 'r', encoding='utf-8') as f, open('scratch/user_history.txt', 'w', encoding='utf-8') as out:
    for line in f:
        data = json.loads(line)
        if data.get('type') == 'USER_INPUT':
            content = data.get('content', '')
            if isinstance(content, str):
                out.write(f"Step {data.get('step_index')}: {content}\n---\n")
            elif isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and 'text' in item:
                        out.write(f"Step {data.get('step_index')}: {item['text']}\n---\n")
print("Wrote user history to scratch/user_history.txt")
