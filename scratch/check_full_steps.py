import json

log_path = r'C:\Users\anggi\.gemini\antigravity-ide\brain\e05d1ede-d3ec-46bd-b263-9f3ba08cffea\.system_generated\logs\transcript_full.jsonl'
with open(log_path, 'r', encoding='utf-8') as f, open('scratch/transcript_full_summary.txt', 'w', encoding='utf-8') as out:
    for line in f:
        data = json.loads(line)
        idx = data.get('step_index', 0)
        # Look at steps from 5784 to 6235
        if idx in [5784, 5785, 5922, 5923, 6230, 6231, 6232, 6233, 6234, 6235]:
            out.write(f"--- STEP {idx} [{data.get('type')}] ---\n")
            c = data.get('content')
            if isinstance(c, str) and c:
                out.write(c[:2000] + "\n")
            tool_calls = data.get('tool_calls', [])
            for tc in tool_calls:
                fn = tc.get('function', {}).get('name')
                args = tc.get('function', {}).get('arguments')
                out.write(f"Tool call: {fn}({str(args)[:300]})\n")
