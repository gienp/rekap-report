import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-final-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9635;
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

    async function evaluate(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      return r.result?.value;
    }

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1600,
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false
    });

    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 4500));

    // Login as admin
    await evaluate(`
      document.getElementById('loginUsername').value = 'admin';
      document.getElementById('loginPassword').value = 'admin123';
      document.getElementById('btnLoginSubmit').click();
    `);

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      const hidden = await evaluate(`document.getElementById('loginOverlay')?.style.display === 'none'`);
      if (hidden) break;
    }
    await new Promise(r => setTimeout(r, 1500));

    // Dismiss banner
    await evaluate(`
      document.getElementById('btnCloseDailyBanner')?.click();
      const modal = document.getElementById('dailyBannerModal');
      if (modal) modal.style.display = 'none';
    `);

    // Navigate to SITAC view
    await evaluate(`
      const btn = document.querySelector('[data-view="view-sitac-pa"]');
      if (btn) btn.click();
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Search for PA 'A821103000441' (ID 522) to verify costs
    await evaluate(`
      const input = document.getElementById('sitacSearchInput');
      input.value = 'A821103000441';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    `);
    await new Promise(r => setTimeout(r, 1500));

    const searchRow = await evaluate(`
      (() => {
        const tr = document.querySelector('#sitacTableBody tr');
        if (!tr) return null;
        const tds = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
        return {
          pa: tds[1],
          pelanggan: tds[2],
          pic: tds[3],
          terminating: tds[4],
          awal: tds[5],
          final: tds[6],
          efisiensi: tds[7]
        };
      })()
    `);
    console.log('Search Result for ID 522 (A821103000441):', searchRow);

    await send('Browser.close');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    try { edgeProc.kill(); } catch (e) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main();
