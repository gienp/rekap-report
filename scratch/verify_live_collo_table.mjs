import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-collo-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9598;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
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
    await new Promise(r => setTimeout(r, 3000));

    // Navigate to Colocation List view
    console.log('Navigating to Colocation List (view-collo-list)...');
    await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const btn = document.querySelector('[data-view="view-collo-list"]');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 3500));

    // Extract table row text
    const rowsRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const trs = document.querySelectorAll('#colloTableBody tr');
          const rows = [];
          trs.forEach((tr, i) => {
            const tds = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim().replace(/\\n+/g, ' '));
            rows.push({ index: i + 1, tds });
          });
          return rows.slice(7, 14); // Rows 8 to 14
        })()
      `,
      returnByValue: true
    });

    console.log('Table Rows 8 to 14:');
    console.log(JSON.stringify(rowsRes.result?.value, null, 2));

    // Scroll to row 10 and take screenshot of the table
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
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'live_collo_table_deduped.png'), buffer);
    console.log('Screenshot saved to scratch/live_collo_table_deduped.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
