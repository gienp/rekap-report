import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-collo-snap-'));
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
    await new Promise(r => setTimeout(r, 2500));
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

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1600,
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false
    });

    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 5000));

    // Instant login as admin
    console.log('Logging in as admin...');
    await send('Runtime.evaluate', {
      expression: `
        (async () => {
          if (window.AuthManager && window.AuthManager.handleLoginSubmit) {
            document.getElementById('loginUsername').value = 'admin';
            document.getElementById('loginPassword').value = 'admin123';
            const fakeEvent = { preventDefault: () => {} };
            await window.AuthManager.handleLoginSubmit(fakeEvent);
          }
        })()
      `,
      awaitPromise: true
    });
    await new Promise(r => setTimeout(r, 2500));

    // Dismiss any open notification modals or overlays
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const dismissBtn = document.querySelector('#modalDailyContractNotification .btn-secondary') ||
                             document.querySelector('#modalDailyContractNotification button:last-child');
          if (dismissBtn) dismissBtn.click();
          const authOverlay = document.getElementById('authOverlay');
          if (authOverlay) authOverlay.classList.add('hidden');
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    // Navigate to Colocation List
    console.log('Navigating to Colocation List (view-collo-list)...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('[data-view="view-collo-list"]');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 3000));

    // Scroll table into view, centering around row 10
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const trs = document.querySelectorAll('#colloTableBody tr');
          if (trs[9]) {
            trs[9].scrollIntoView({ behavior: 'instant', block: 'center' });
          }
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    const snap = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(snap.data, 'base64');
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'live_collo_table_deduped_wide.png'), buffer);
    console.log('Wide screenshot saved to scratch/live_collo_table_deduped_wide.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
