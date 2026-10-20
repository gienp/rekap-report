import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-mobile-snap2-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9644;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=375,812',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`http://localhost:${port}/json`);
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
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

    async function evaluate(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      return r.result?.value;
    }

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });

    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 3500));

    // Login as PIC Brian
    await evaluate(`
      document.getElementById('loginUsername').value = 'brian';
      document.getElementById('loginPassword').value = 'pic123';
      document.getElementById('btnLoginSubmit').click();
    `);

    for (let i = 0; i < 30; i++) {
      const isLoginHidden = await evaluate(`document.getElementById('loginOverlay')?.style.display === 'none'`);
      if (isLoginHidden) break;
      await new Promise(r => setTimeout(r, 500));
    }
    await new Promise(r => setTimeout(r, 2000));

    // Scroll down to table
    await evaluate(`
      const tb = document.querySelector('.table-container-card');
      if (tb) tb.scrollIntoView({ behavior: 'instant', block: 'start' });
    `);
    await new Promise(r => setTimeout(r, 1000));

    const snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_table_before.png', Buffer.from(snap.data, 'base64'));
    console.log('Saved scratch/mobile_table_before.png');

    // Also toggle mobile sidebar
    await evaluate(`
      document.getElementById('sidebarToggleBtn')?.click();
    `);
    await new Promise(r => setTimeout(r, 800));

    const snapSidebar = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_sidebar_before.png', Buffer.from(snapSidebar.data, 'base64'));
    console.log('Saved scratch/mobile_sidebar_before.png');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main();
