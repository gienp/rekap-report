import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

view_ids = re.findall(r'id=["\'](view-[^"\']+)["\']', html)
print("HTML View IDs:", view_ids)

canvas_ids = re.findall(r'<canvas[^>]*id=["\']([^"\']+)["\']', html)
print("\nHTML Canvas IDs:", canvas_ids)
