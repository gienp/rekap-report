import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-filter-snap2-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9887;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 2000));

    // Log in
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('loginUsername').value = 'admin';
          document.getElementById('loginPassword').value = 'admin123';
          document.getElementById('btnLoginSubmit')?.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2500));

    // Click 2025
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.querySelector('#execPeriodQuickPills button[data-period="2025"]')?.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    // Scroll to bottom
    await send('Runtime.evaluate', {
      expression: `window.scrollTo(0, 1100);`
    });
    await new Promise(r => setTimeout(r, 1000));

    // Screenshot of bottom charts in 2025
    const shotBottom = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/screenshot_dashboard_2025_bottom.png', Buffer.from(shotBottom.data, 'base64'));

    console.log('Bottom screenshot saved successfully!');
    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
