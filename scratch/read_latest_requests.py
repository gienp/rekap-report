import json, sys

path = r'C:\Users\anggi\.gemini\antigravity-ide\brain\2c63f812-2c94-4f6c-b883-beb4f4341743\.system_generated\logs\transcript.jsonl'
with open(path, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        if data.get('type') == 'USER_INPUT':
            content = data.get('content', '')
            if '<USER_REQUEST>' in content:
                req = content.split('<USER_REQUEST>')[1].split('</USER_REQUEST>')[0].strip()
                if data.get('step_index', 0) > 8500:
                    idx = data.get('step_index')
                    sys.stdout.buffer.write(f"[{idx}] {req}\n".encode('utf-8'))
