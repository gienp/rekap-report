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
    '--remote-debugging-port=9229',
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
    tabs = json.loads(urllib.request.urlopen('http://localhost:9229/json').read().decode())
    target_tab = tabs[0]
    ws = websocket.create_connection(target_tab['webSocketDebuggerUrl'])

    # Set auth and reload
    cdp_send(ws, 'Runtime.evaluate', {
        'expression': """
        localStorage.setItem('telecom_portal_user', JSON.stringify({id: 1, username: 'admin', role: 'admin', full_name: 'Administrator'}));
        localStorage.setItem('telecom_portal_token', 'token123');
        """
    })
    cdp_send(ws, 'Page.navigate', {'url': 'http://localhost:8888/'})
    time.sleep(2)

    # Open admin modal and switch to email tab
    res = cdp_send(ws, 'Runtime.evaluate', {
        'expression': """
        (() => {
            const btn = document.getElementById('btnOpenAdminUsers');
            if (btn) btn.click();
            const emailTabBtn = document.querySelector('button[data-tab="email"]');
            if (emailTabBtn) {
                emailTabBtn.click();
                return 'clicked email tab';
            }
            return 'email tab not found';
        })()
        """
    })
    print("Tab switch res:", res)
    time.sleep(1)

    shot = cdp_send(ws, 'Page.captureScreenshot')
    with open('scratch/verify_modal_email_tab_active.png', 'wb') as f:
        f.write(base64.b64decode(shot['result']['data']))
    print("Saved scratch/verify_modal_email_tab_active.png")

finally:
    proc.terminate()
