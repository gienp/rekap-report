import urllib.request
import json

endpoints = [
    ('SITAC 2024', 'http://localhost:8888/api/sitac?year=2024'),
    ('Executive 2024', 'http://localhost:8888/api/executive/summary?year=2024'),
    ('Rekap Efisiensi', 'http://localhost:8888/api/rekap-efisiensi'),
    ('Map Coordinates', 'http://localhost:8888/api/map-coordinates'),
    ('PIC Matrix 2024', 'http://localhost:8888/api/pic-matrix?year=2024'),
    ('Gangguan 2024', 'http://localhost:8888/api/gangguan?search=2024')
]

for name, url in endpoints:
    try:
        req = urllib.request.urlopen(url)
        data = json.loads(req.read().decode())
        if isinstance(data, list):
            print(f'{name}: {len(data)} items')
            if data and isinstance(data[0], dict):
                print(f'   Sample: {list(data[0].items())[:3]}')
        elif isinstance(data, dict):
            tot = data.get('total') or data.get('total_pa') or len(data)
            print(f'{name}: total={tot}, keys={list(data.keys())[:5]}')
            if 'summary' in data:
                print(f'   Summary: {data["summary"]}')
            if 'counts' in data:
                print(f'   Counts: {data["counts"]}')
    except Exception as e:
        print(f'{name} ERROR:', e)
