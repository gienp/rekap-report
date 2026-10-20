import json

with open('C:/Users/anggi/.gemini/antigravity-ide/brain/2c63f812-2c94-4f6c-b883-beb4f4341743/.system_generated/logs/transcript.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        if data.get('type') == 'USER_INPUT' and data.get('step_index', 0) >= 5500:
            content = data.get('content', '')
            req = ''
            if '<USER_REQUEST>' in content:
                req = content.split('<USER_REQUEST>')[1].split('</USER_REQUEST>')[0].strip()
            else:
                req = content[:100].strip()
            print(f"Step {data.get('step_index')}: {req.encode('ascii', 'replace').decode('ascii')}")
