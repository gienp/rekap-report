import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-revshare-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9625;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1600,1100',
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

    async function evaluate(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      return r.result?.value;
    }

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1500,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Navigating to http://localhost:8888...');
    await send('Page.navigate', { url: 'http://localhost:8888' });
    await new Promise(r => setTimeout(r, 3000));

    // Login as admin
    console.log('Logging in as admin...');
    await evaluate(`
      document.getElementById('loginUsername').value = 'admin';
      document.getElementById('loginPassword').value = 'admin123';
      document.getElementById('btnLoginSubmit').click();
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Switch to view-collo-rev-sharing
    console.log('Switching to view-collo-rev-sharing...');
    await evaluate(`
      const navItem = document.querySelector('[data-view="view-collo-rev-sharing"]');
      if (navItem) navItem.click();
    `);
    await new Promise(r => setTimeout(r, 2500));

    // Get all cells in Rata-rata % Sharing column
    const cells = await evaluate(`
      Array.from(document.querySelectorAll('#revSharePengelolaTableBody tr')).map(tr => {
        const tds = tr.querySelectorAll('td');
        return {
          pengelola: tds[0]?.innerText.trim(),
          avgPct: tds[4]?.innerText.trim()
        };
      })
    `);
    console.log('Pengelola Table Avg % Sharing cells:');
    console.log(JSON.stringify(cells, null, 2));

    // Scroll to table and capture screenshot
    await evaluate(`
      document.getElementById('revSharePengelolaTableBody')?.scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise(r => setTimeout(r, 800));

    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea\\rev_sharing_percentages_no_comma_verified.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved rev_sharing_percentages_no_comma_verified.png');

    // Also test https://analytics-811fc.web.app
    console.log('Navigating to https://analytics-811fc.web.app...');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 4000));

    await evaluate(`
      document.getElementById('loginUsername').value = 'admin';
      document.getElementById('loginPassword').value = 'admin123';
      document.getElementById('btnLoginSubmit').click();
    `);
    await new Promise(r => setTimeout(r, 2000));

    await evaluate(`
      const navItem = document.querySelector('[data-view="view-collo-rev-sharing"]');
      if (navItem) navItem.click();
    `);
    await new Promise(r => setTimeout(r, 2500));

    const hostedCells = await evaluate(`
      Array.from(document.querySelectorAll('#revSharePengelolaTableBody tr')).map(tr => {
        const tds = tr.querySelectorAll('td');
        return {
          pengelola: tds[0]?.innerText.trim(),
          avgPct: tds[4]?.innerText.trim()
        };
      })
    `);
    console.log('Hosted Firebase Table Avg % Sharing cells:');
    console.log(JSON.stringify(hostedCells, null, 2));

    ws.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edgeProc.kill();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

main();
