import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function capture() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-charts-snap-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9594;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + tmpDir,
    '--window-size=1600,1200',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://localhost:' + port + '/json');
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

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 3000));

    // Login
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('loginUsername').value = 'admin';
        document.getElementById('loginPassword').value = 'admin123';
        document.getElementById('btnLoginSubmit').click();
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    // Close banner
    await send('Runtime.evaluate', {
      expression: `
        const btn = document.querySelector('#bannerExpiringAlert button');
        if (btn) btn.click();
      `
    });

    // 1. Rev sharing view
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.nav-item[data-view="view-collo-rev-sharing"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 2000));

    // Scroll directly to chartRevShareMitra
    await send('Runtime.evaluate', {
      expression: `document.getElementById('chartRevShareMitra')?.scrollIntoView({ behavior: 'instant', block: 'center' });`
    });
    await new Promise(r => setTimeout(r, 500));
    const snapRev = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/snap_rev_sharing_charts.png', Buffer.from(snapRev.data, 'base64'));
    console.log('Rev sharing screenshot saved!');

    // 2. Alerts view
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.nav-item[data-view="view-collo-alerts"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 2000));
    await send('Runtime.evaluate', {
      expression: `document.getElementById('chartAlertsCategoryDonut')?.scrollIntoView({ behavior: 'instant', block: 'center' });`
    });
    await new Promise(r => setTimeout(r, 500));
    const snapAlerts = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/snap_alerts_charts.png', Buffer.from(snapAlerts.data, 'base64'));
    console.log('Alerts screenshot saved!');

  } finally {
    edgeProc.kill('SIGKILL');
  }
}

capture().catch(console.error);
