import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-dup-snap-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9599;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1600,1050',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`http://localhost:${port}/json`);
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

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1050, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://localhost:8888/index.html' });
    await new Promise(r => setTimeout(r, 2500));

    // Login & Open modalAddSitac
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('loginUsername').value = 'admin';
          document.getElementById('loginPassword').value = 'admin123';
          document.getElementById('btnLoginSubmit').click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('btnCloseDailyBanner')?.click();
          document.getElementById('btnOpenAddSitacDirect')?.click();
          const noPaIn = document.getElementById('addSitacNoPa');
          noPaIn.value = 'R141401002528';
          noPaIn.dispatchEvent(new Event('input', { bubbles: true }));
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    const snap = await send('Page.captureScreenshot', { format: 'png', quality: 90 });
    fs.writeFileSync('scratch/verified_duplicate_warning.png', Buffer.from(snap.data, 'base64'));
    console.log('Duplicate screenshot saved!');
    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
