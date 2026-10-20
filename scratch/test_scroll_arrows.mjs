import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-scroll-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9888;
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

    // Switch to View 2 (Daftar Link & Finansial)
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('button[data-view="view-collo-list"], a[data-view="view-collo-list"]');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Check table width and scroll dimensions
    const info = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = document.querySelector('#view-collo-list .table-container-card');
          const wrapper = card ? card.querySelector('.overflow-x-auto') : null;
          const table = wrapper ? wrapper.querySelector('table') : null;
          return {
            cardRect: card ? card.getBoundingClientRect() : null,
            wrapperScrollWidth: wrapper ? wrapper.scrollWidth : null,
            wrapperClientWidth: wrapper ? wrapper.clientWidth : null,
            tableWidth: table ? table.offsetWidth : null,
            canScrollHorizontally: wrapper ? wrapper.scrollWidth > wrapper.clientWidth : false
          };
        })()
      `,
      returnByValue: true
    });
    console.log('TABLE SCROLL INFO:', JSON.stringify(info.result.value, null, 2));

    ws.close();
  } finally {
    try { edgeProc.kill(); } catch (e) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
