import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-2024-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9630;
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
    await evaluate(`
      document.getElementById('loginUsername').value = 'admin';
      document.getElementById('loginPassword').value = 'admin123';
      document.getElementById('btnLoginSubmit').click();
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Dismiss reminder popup
    await evaluate(`
      const closeBtns = document.querySelectorAll('.reminder-banner-close, [data-dismiss="reminder"], .btn-reminder-dismiss');
      closeBtns.forEach(b => b.click());
    `);

    // Switch to view-sitac-pa
    console.log('Switching to view-sitac-pa...');
    await evaluate(`
      const navItem = document.querySelector('[data-view="view-sitac-pa"]');
      if (navItem) navItem.click();
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Select Year 2024
    console.log('Selecting year 2024 in SITAC...');
    await evaluate(`
      const sel = document.getElementById('sitacFilterYear');
      if (sel) {
        sel.value = '2024';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    `);
    await new Promise(r => setTimeout(r, 2000));

    const sitac2024Stats = await evaluate(`
      ({
        pagination: document.getElementById('sitacPaginationInfo')?.innerText,
        countAll: document.getElementById('sitacTabCountAll')?.innerText,
        countFinish: document.getElementById('sitacTabCountFinish')?.innerText,
        countOngoing: document.getElementById('sitacTabCountOngoing')?.innerText,
        countHold: document.getElementById('sitacTabCountHold')?.innerText,
        countCancel: document.getElementById('sitacTabCountCancel')?.innerText,
      })
    `);
    console.log('SITAC 2024 UI Stats:', sitac2024Stats);

    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea\\sitac_2024_complete_verified.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved sitac_2024_complete_verified.png');

    // Switch to view-efisiensi
    console.log('Switching to view-efisiensi...');
    await evaluate(`
      const navItem = document.querySelector('[data-view="view-efisiensi"]');
      if (navItem) navItem.click();
    `);
    await new Promise(r => setTimeout(r, 2000));

    const efisiensiRows = await evaluate(`
      Array.from(document.querySelectorAll('#rekapEfisiensiTableBody tr')).map(tr => {
        const tds = tr.querySelectorAll('td');
        return {
          tahun: tds[0]?.innerText.trim(),
          totalDisposisi: tds[1]?.innerText.trim(),
          adaBiaya: tds[2]?.innerText.trim(),
          tidakAdaBiaya: tds[3]?.innerText.trim(),
          nilaiAwal: tds[4]?.innerText.trim(),
          nilaiAkhir: tds[5]?.innerText.trim(),
          efisiensiRp: tds[6]?.innerText.trim(),
          efisiensiPct: tds[7]?.innerText.trim()
        };
      })
    `);
    console.log('Rekap Efisiensi Table Rows:');
    console.log(JSON.stringify(efisiensiRows, null, 2));

    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea\\efisiensi_2024_complete_verified.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved efisiensi_2024_complete_verified.png');

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
