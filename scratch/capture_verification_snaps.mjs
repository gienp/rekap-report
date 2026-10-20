import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

async function run() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-snap-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9598;

  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1536,920',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const r = await fetch(`http://localhost:${cdpPort}/json`);
    const tabs = await r.json();
    const pageTab = tabs.find(t => t.type === 'page');

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

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
      const res = await send('Runtime.evaluate', { expression, returnByValue: true });
      return res.result?.value;
    }

    async function screenshot(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filename, Buffer.from(res.data, 'base64'));
      console.log(`Saved screenshot: ${filename}`);
    }

    await send('Runtime.enable');
    await send('Page.enable');

    await send('Page.navigate', { url: 'http://localhost:8888' });
    await new Promise(res => setTimeout(res, 3500));

    // Admin login
    await evaluate(`
      (() => {
        localStorage.setItem('telecom_portal_user', JSON.stringify({
          username: 'admin',
          full_name: 'Administrator (Manajemen)',
          role: 'admin',
          avatar_icon: 'fa-shield-halved',
          badge_color: 'cyan',
          pic_code: ''
        }));
      })()
    `);
    await send('Page.reload');
    await new Promise(res => setTimeout(res, 3500));

    // 1. Snapshot SITAC Regional Filter Tabs and KPI Cards
    await evaluate(`
      (() => {
        document.querySelector('[data-view="view-sitac-pa"]')?.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));
    await screenshot('scratch/snapshot_sitac_regional_verified.png');

    // 2. Snapshot Regional Efficiency Matrix
    await evaluate(`
      (() => {
        document.querySelector('[data-view="view-efisiensi"]')?.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));
    await screenshot('scratch/snapshot_efisiensi_regional_verified.png');

    // 3. Snapshot Colocation table with clean Pengelola filter
    await evaluate(`
      (() => {
        document.querySelector('[data-view="view-collo-list"]')?.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));
    await screenshot('scratch/snapshot_collo_pengelola_verified.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

run().catch(console.error);
