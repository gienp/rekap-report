import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-btm-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9893;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--force-device-scale-factor=1',
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
          const data = JSON.parse(e.data);
          if (data.id === id) {
            ws.removeEventListener('message', handler);
            if (data.error) reject(data.error);
            else resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        localStorage.setItem('telecom_portal_user', JSON.stringify({
          id: 1,
          username: 'admin',
          full_name: 'Administrator (Manajemen)',
          role: 'admin',
          email: 'admin@telecom.co.id'
        }));
        localStorage.setItem('portal_theme', 'dark');
      `
    });

    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 3000));

    // Switch to View 2
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('button[data-view="view-collo-list"], a[data-view="view-collo-list"]');
          if (btn) btn.click();
          const btnLater = document.getElementById('btnRemindLaterContract');
          if (btnLater) btnLater.click();
          const banner = document.getElementById('dailyContractAlertBanner');
          if (banner) banner.style.display = 'none';
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Scroll table to the end (to match user's screenshot showing AKSI column)
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const wrapper = document.getElementById('colloTableScrollWrapper');
          wrapper.scrollLeft = wrapper.scrollWidth;
        })()
      `
    });
    await new Promise(r => setTimeout(r, 500));

    // Scroll window down to show the bottom pagination and the scrollbar
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pag = document.querySelector('.table-pagination');
          if (pag) pag.scrollIntoView({ behavior: 'instant', block: 'end' });
        })()
      `
    });
    await new Promise(r => setTimeout(r, 800));

    const snap = await send('Page.captureScreenshot', { format: 'png' });
    const out = path.join(process.cwd(), 'scratch', 'table_scroll_bottom_verified.png');
    fs.writeFileSync(out, Buffer.from(snap.data, 'base64'));

    const artifactDir = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';
    fs.copyFileSync(out, path.join(artifactDir, 'table_scroll_bottom_verified.png'));
    console.log('Saved table_scroll_bottom_verified.png');

    ws.close();
  } finally {
    try { edgeProc.kill(); } catch (e) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
