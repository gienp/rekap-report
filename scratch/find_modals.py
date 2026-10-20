with open('index.html', 'r', encoding='utf-8', errors='ignore') as f:
    for i, line in enumerate(f, 1):
        if 'class="portal-modal-overlay"' in line or 'class="modal-card' in line or 'class="portal-modal-card' in line:
            print(str(i) + ': ' + line.strip()[:100])
