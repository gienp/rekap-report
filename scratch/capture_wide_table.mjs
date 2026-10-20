import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-wide-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9608;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1920,1080',
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
    await new Promise(r => setTimeout(r, 4000));

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
    await new Promise(r => setTimeout(r, 2000));

    // Dismiss banner
    await evaluate(`
      document.getElementById('btnCloseDailyBanner')?.click();
      const modal = document.getElementById('dailyBannerModal');
      if (modal) modal.style.display = 'none';
    `);

    // Navigate to view-collo-list
    await evaluate(`
      const btn = document.querySelector('[data-view="view-collo-list"]');
      if (btn) btn.click();
    `);
    await new Promise(r => setTimeout(r, 3000));

    // Search for A821204000046
    await evaluate(`
      const inp = document.getElementById('colloSearchInput');
      if (inp) {
        inp.value = 'A821204000046';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Scroll table into view and scroll the table wrapper horizontally so the columns match user screenshot
    await evaluate(`
      const wrapper = document.querySelector('#view-collo-list .overflow-x-auto');
      if (wrapper) wrapper.scrollLeft = 180;
      const table = document.querySelector('#view-collo-list table');
      if (table) table.scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise(r => setTimeout(r, 1000));

    const snapWide = await send('Page.captureScreenshot', { format: 'png' });
    const bufferWide = Buffer.from(snapWide.data, 'base64');
    const artifactPath = path.join(
      'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\2c63f812-2c94-4f6c-b883-beb4f4341743',
      'live_case_consolidation_verified.png'
    );
    fs.writeFileSync(artifactPath, bufferWide);
    console.log('Saved horizontal scroll view to artifact:', artifactPath);

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
