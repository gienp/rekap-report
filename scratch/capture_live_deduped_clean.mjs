import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-snap-clean-'));
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
    await new Promise(r => setTimeout(r, 4000));

    // Fill credentials and click login
    console.log('Submitting login form...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('loginUsername').value = 'admin';
          document.getElementById('loginPassword').value = 'admin123';
          document.getElementById('btnLoginSubmit').click();
        })()
      `
    });

    // Wait for login overlay to disappear
    await new Promise(r => setTimeout(r, 3000));

    // Close any popup notification
    console.log('Closing any popups/modals...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const closeBtn = document.getElementById('btnCloseDailyNotification') ||
                           document.querySelector('#modalDailyContractNotification [onclick*="close"]') ||
                           document.querySelector('#modalDailyContractNotification button:last-child');
          if (closeBtn) closeBtn.click();
          const modal = document.getElementById('modalDailyContractNotification');
          if (modal) modal.style.display = 'none';
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    // Navigate to Colocation List view
    console.log('Navigating to view-collo-list...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('[data-view="view-collo-list"]');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 3000));

    // Scroll to table and center rows 9-12
    console.log('Centering table on row 10...');
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
    await new Promise(r => setTimeout(r, 1500));

    // Capture screenshot
    const snap = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(snap.data, 'base64');
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'live_collo_table_deduped_verified.png'), buffer);
    console.log('Screenshot saved to scratch/live_collo_table_deduped_verified.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
