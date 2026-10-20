with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if 'new Chart' in line:
        print(f"Line {idx+1}: {line.strip()}")
        # print next 30 lines
        for j in range(idx, min(idx + 35, len(lines))):
            if any(k in lines[j] for k in ['borderColor', 'borderWidth', 'donutBorder', 'scales', 'grid', 'border:']):
                print(f"   {j+1}: {lines[j].strip()}")
