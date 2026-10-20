import subprocess
import time
import json
import urllib.request
import os
import websocket
import base64

cmd = [
    r'C:\Users\anggi\AppData\Local\Google\Chrome\Application\chrome.exe',
    '--headless=new',
    '--remote-debugging-port=9227',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1366,850',
    'http://localhost:8888/'
]
proc = subprocess.Popen(cmd)
time.sleep(2.5)

msg_id = 0

def cdp_send(ws, method, params=None):
    global msg_id
    msg_id += 1
    msg = {'id': msg_id, 'method': method, 'params': params or {}}
    ws.send(json.dumps(msg))
    while True:
        resp = json.loads(ws.recv())
        if resp.get('id') == msg_id:
            return resp

try:
    tabs = json.loads(urllib.request.urlopen('http://localhost:9227/json').read().decode())
    target_tab = None
    for t in tabs:
        if t.get('type') == 'page':
            target_tab = t
            break
    if not target_tab:
        target_tab = tabs[0]
        
    ws_url = target_tab['webSocketDebuggerUrl']
    ws = websocket.create_connection(ws_url)

    # 1. Clear storage so we see Login screen
    cdp_send(ws, 'Runtime.evaluate', {
        'expression': "localStorage.clear(); sessionStorage.clear();"
    })
    cdp_send(ws, 'Page.navigate', {'url': 'http://localhost:8888/'})
    time.sleep(2)

    # Take screenshot of login in dark mode
    shot = cdp_send(ws, 'Page.captureScreenshot')
    with open('scratch/verify_login_dark.png', 'wb') as f:
        f.write(base64.b64decode(shot['result']['data']))
    print("Saved scratch/verify_login_dark.png")

    # Switch to light mode
    cdp_send(ws, 'Runtime.evaluate', {
        'expression': "document.documentElement.setAttribute('data-theme', 'light');"
    })
    time.sleep(0.5)
    shot = cdp_send(ws, 'Page.captureScreenshot')
    with open('scratch/verify_login_light.png', 'wb') as f:
        f.write(base64.b64decode(shot['result']['data']))
    print("Saved scratch/verify_login_light.png")

    # Set auth and reload
    cdp_send(ws, 'Runtime.evaluate', {
        'expression': """
        localStorage.setItem('telecom_portal_user', JSON.stringify({id: 1, username: 'admin', role: 'admin', full_name: 'Administrator'}));
        localStorage.setItem('telecom_portal_token', 'token123');
        document.documentElement.removeAttribute('data-theme');
        """
    })
    cdp_send(ws, 'Page.navigate', {'url': 'http://localhost:8888/'})
    time.sleep(2)

    shot = cdp_send(ws, 'Page.captureScreenshot')
    with open('scratch/verify_dashboard_dark.png', 'wb') as f:
        f.write(base64.b64decode(shot['result']['data']))
    print("Saved scratch/verify_dashboard_dark.png")

    # Open admin modal and email tab
    cdp_send(ws, 'Runtime.evaluate', {
        'expression': """
        const btn = document.getElementById('btnOpenAdminUsers');
        if (btn) btn.click();
        """
    })
    time.sleep(1.0)
    cdp_send(ws, 'Runtime.evaluate', {
        'expression': """
        const tab = document.querySelector('.admin-tab[data-tab="email"]');
        if (tab) tab.click();
        """
    })
    time.sleep(0.8)

    shot = cdp_send(ws, 'Page.captureScreenshot')
    with open('scratch/verify_modal_email.png', 'wb') as f:
        f.write(base64.b64decode(shot['result']['data']))
    print("Saved scratch/verify_modal_email.png")

finally:
    proc.terminate()
