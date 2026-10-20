import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-caturmas-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9615;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1600,1000',
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
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 4500));

    // Login as admin
    console.log('Logging in...');
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

    // Navigate to view-collo-list
    console.log('Navigating to Colocation List view...');
    await evaluate(`
      const btn = document.querySelector('[data-view="view-collo-list"]');
      if (btn) btn.click();
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Check options
    const checkResult = await evaluate(`
      (() => {
        const select = document.getElementById('colloFilterPengelola');
        if (!select) return { error: 'colloFilterPengelola not found' };
        const texts = Array.from(select.options).map(o => o.text);
        const caturmas = texts.filter(t => t.toLowerCase().includes('caturmas'));
        const caltumas = texts.filter(t => t.toLowerCase().includes('caltumas'));
        return {
          total: texts.length,
          caturmas,
          caltumas
        };
      })()
    `);
    console.log('Dropdown Search Results:', checkResult);

    // Select "Caturmas Kelola Sukses"
    console.log('Selecting Caturmas Kelola Sukses in filter...');
    await evaluate(`
      const select = document.getElementById('colloFilterPengelola');
      select.value = 'Caturmas Kelola Sukses';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Inspect table rows
    const tableInfo = await evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('#colloTableBody tr'));
        return rows.map(tr => {
          const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
          return {
            id: cells[0],
            pengelola: cells[1],
            pelanggan: cells[2],
            so: cells[3]
          };
        });
      })()
    `);
    console.log('Filtered Table Results (Caturmas Kelola Sukses):', tableInfo);

    // Take screenshot of filter and table
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.data, 'base64');
    fs.writeFileSync('scratch/caturmas_verified.png', buffer);
    console.log('Saved screenshot to scratch/caturmas_verified.png');

    await send('Browser.close');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    try { edgeProc.kill(); } catch (e) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main();
