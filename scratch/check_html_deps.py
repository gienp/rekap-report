import re

with open('index.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

scripts = re.findall(r'<script[^>]*src=["\']([^"\']+)["\']', text)
links = re.findall(r'<link[^>]*href=["\']([^"\']+)["\']', text)
print('Scripts:', scripts)
print('Links:', links)
