import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-top-collo-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9602;
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

    console.log('Navigating to live Firebase URL...');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 4000));

    // Login as admin
    console.log('Logging in as admin...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('loginUsername').value = 'admin';
          document.getElementById('loginPassword').value = 'admin123';
          document.getElementById('btnLoginSubmit').click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 3000));

    // Dismiss any notification modal
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('#modalDailyContractNotification button:last-child');
          if (btn) btn.click();
          const modal = document.getElementById('modalDailyContractNotification');
          if (modal) modal.style.display = 'none';
        })()
      `
    });

    // Navigate to view-collo-list
    console.log('Navigating to view-collo-list...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('[data-view="view-collo-list"]');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 3500));

    // Extract table rows 1 to 6
    const rowsRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const trs = document.querySelectorAll('#colloTableBody tr');
          const rows = [];
          trs.forEach((tr, i) => {
            const tds = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim().replace(/\\n+/g, ' '));
            rows.push({ index: i + 1, tds });
          });
          return rows.slice(0, 6);
        })()
      `,
      returnByValue: true
    });

    console.log('Live Table Rows 1 to 6:');
    console.log(JSON.stringify(rowsRes.result?.value, null, 2));

    // Scroll to table header and capture screenshot
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.getElementById('view-collo-list');
          if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    const snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(process.cwd(), 'scratch', 'live_collo_top_deduped.png'),
      Buffer.from(snap.data, 'base64')
    );
    console.log('Screenshot saved to scratch/live_collo_top_deduped.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
