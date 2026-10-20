import json

log_path = r'C:\Users\anggi\.gemini\antigravity-ide\brain\e05d1ede-d3ec-46bd-b263-9f3ba08cffea\.system_generated\logs\transcript.jsonl'
with open(log_path, 'r', encoding='utf-8') as f, open('scratch/agent_responses_recent.txt', 'w', encoding='utf-8') as out:
    for line in f:
        data = json.loads(line)
        idx = data.get('step_index', 0)
        if idx in [5572, 5573, 5574, 5578, 5579, 5596, 5597, 5784, 5785, 5922, 5923] or (idx >= 5570 and idx <= 5605) or (idx >= 5780 and idx <= 5800) or (idx >= 5920 and idx <= 5940):
            if data.get('type') in ['USER_INPUT', 'PLANNER_RESPONSE']:
                content = data.get('content', '')
                out.write(f"Step {idx} [{data.get('type')}]:\n{content}\n" + "="*50 + "\n")
print("Wrote recent responses to scratch/agent_responses_recent.txt")
