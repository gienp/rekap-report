import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-dropdown-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9610;
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
    console.log('Logging in as admin...');
    await evaluate(`
      document.getElementById('loginUsername').value = 'admin';
      document.getElementById('loginPassword').value = 'admin123';
      document.getElementById('btnLoginSubmit').click();
    `);

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      const hidden = await evaluate(`document.getElementById('loginOverlay')?.style.display === 'none'`);
      if (hidden) {
        console.log('Login successful!');
        break;
      }
    }
    await new Promise(r => setTimeout(r, 2000));

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
    await new Promise(r => setTimeout(r, 3000));

    // Extract options from colloFilterJenis
    const jenisOptions = await evaluate(`
      (() => {
        const select = document.getElementById('colloFilterJenis');
        if (!select) return { error: 'colloFilterJenis not found' };
        return Array.from(select.options).map(opt => ({
          value: opt.value,
          text: opt.text
        }));
      })()
    `);
    console.log('\n=== LIVE colloFilterJenis Options ===');
    console.log(JSON.stringify(jenisOptions, null, 2));

    // Extract options from colloFilterPengelola
    const pengelolaOptions = await evaluate(`
      (() => {
        const select = document.getElementById('colloFilterPengelola');
        if (!select) return { error: 'colloFilterPengelola not found' };
        return Array.from(select.options).map(opt => opt.text);
      })()
    `);
    console.log(`\n=== LIVE colloFilterPengelola Total Options: ${pengelolaOptions?.length} ===`);

    // Check for any duplicate casing in pengelolaOptions
    const pCasingCheck = {};
    const pDups = [];
    (pengelolaOptions || []).forEach(opt => {
      const lower = opt.toLowerCase();
      if (pCasingCheck[lower] && pCasingCheck[lower] !== opt) {
        pDups.push([pCasingCheck[lower], opt]);
      }
      pCasingCheck[lower] = opt;
    });
    console.log('Pengelola duplicates:', pDups);

    // Focus on select and scroll into view to capture screenshot
    await evaluate(`
      const select = document.getElementById('colloFilterJenis');
      if (select) {
        select.scrollIntoView({ behavior: 'instant', block: 'center' });
        select.focus();
      }
    `);
    await new Promise(r => setTimeout(r, 1000));

    const snap = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(snap.data, 'base64');
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'live_collo_filter_jenis_verified.png'), buffer);
    console.log('Saved scratch/live_collo_filter_jenis_verified.png');

    const artifactPath = path.join(
      'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\2c63f812-2c94-4f6c-b883-beb4f4341743',
      'live_dropdown_dedup_verified.png'
    );
    fs.writeFileSync(artifactPath, buffer);
    console.log('Saved to artifact:', artifactPath);

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
