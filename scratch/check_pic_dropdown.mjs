import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

async function checkOptions() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-opts-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9594;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + cdpPort,
    '--user-data-dir=' + tmpDir,
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://localhost:' + cdpPort + '/json');
    const tabs = await res.json();
    const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const handler = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.id === id) {
            ws.removeEventListener('message', handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Runtime.enable');
    await send('Page.enable');

    const testUrl = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');
    await send('Page.navigate', { url: testUrl });
    await new Promise(r => setTimeout(r, 2000));

    // Log in as harlan
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('loginUsername').value = 'harlan';
          document.getElementById('loginPassword').value = 'pic123';
          document.getElementById('btnLoginSubmit').click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    // Switch view
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          switchView('view-sitac-colleagues');
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    const evalRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const sel = document.getElementById('selectColleaguesPic');
          return sel ? Array.from(sel.options).map(o => o.text) : [];
        })()
      `,
      returnByValue: true
    });

    console.log('Dropdown Option Texts:\n', evalRes.result.value);

  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

checkOptions();
