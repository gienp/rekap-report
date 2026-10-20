import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function captureBars() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-bars-snap-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9595;
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

    // Hide banner with display: none so it doesn't block the view
    await send('Runtime.evaluate', {
      expression: `
        const b = document.getElementById('bannerExpiringAlert');
        if (b) b.style.display = 'none';
      `
    });

    // Rev sharing
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.nav-item[data-view="view-collo-rev-sharing"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 2000));

    await send('Runtime.evaluate', {
      expression: `document.getElementById('chartRevShareCompare')?.scrollIntoView({ behavior: 'instant', block: 'center' });`
    });
    await new Promise(r => setTimeout(r, 500));
    const snapRevBar = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/snap_rev_sharing_bar.png', Buffer.from(snapRevBar.data, 'base64'));

    // Alerts
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.nav-item[data-view="view-collo-alerts"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 2000));

    await send('Runtime.evaluate', {
      expression: `document.getElementById('chartAlertsSisaHari')?.scrollIntoView({ behavior: 'instant', block: 'center' });`
    });
    await new Promise(r => setTimeout(r, 500));
    const snapAlertsBar = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/snap_alerts_bar.png', Buffer.from(snapAlertsBar.data, 'base64'));

    console.log('Bar chart screenshots captured!');
  } finally {
    edgeProc.kill('SIGKILL');
  }
}

captureBars().catch(console.error);
