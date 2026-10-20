with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Find charts and their configurations
chart_names = [
    'topPengelola', 'sitacStatus', 'jenisSewa', 'expirationDonut', 'monthlyTrend', 'efisiensiTahunan',
    'colloStatusDist', 'colloTopVendors', 'revShareMitra', 'revShareCompare',
    'alertsCategoryDonut', 'alertsSisaHari', 'sitacAging', 'sitacStatusDetail',
    'gangguanJenis', 'gangguanSla', 'efisiensiCompare', 'efisiensiPct', 'picWorkload', 'picFinishRate'
]

for name in chart_names:
    pattern = rf'charts\.{name}\s*=\s*new Chart\([^,]+,\s*\{{([\s\S]*?)\n    \}}\);'
    m = re.search(pattern, text)
    if not m:
        # try alternative pattern
        pattern = rf'new Chart\([a-zA-Z0-9_]+,\s*\{{([\s\S]*?)\n    \}}\);'
    print(f"\n==================== CHART: {name} ====================")
    if m:
        content = m.group(1)
        # Look for borderColor, backgroundColor, scales, grid
        for line in content.split('\n'):
            line_str = line.strip()
            if any(k in line_str for k in ['borderColor', 'borderWidth', 'border:', 'grid', 'color:', 'color :', '#0', 'rgba(0']):
                print(" ", line_str)
    else:
        print("  NOT MATCHED BY REGEX")
