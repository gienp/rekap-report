import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function verifyLive() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-live-charts-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9591;
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
    await new Promise(r => setTimeout(r, 3500));

    // Login
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('loginUsername').value = 'admin';
        document.getElementById('loginPassword').value = 'admin123';
        document.getElementById('btnLoginSubmit').click();
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    // 1. REV SHARING
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.nav-item[data-view="view-collo-rev-sharing"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 1500));

    // 2. ALERTS
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.nav-item[data-view="view-collo-alerts"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 1500));

    const stats = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const c1 = Chart.getChart('chartAlertsCategoryDonut');
          const c2 = Chart.getChart('chartAlertsSisaHari');
          const m1 = Chart.getChart('chartRevShareMitra');
          const m2 = Chart.getChart('chartRevShareCompare');
          return {
            alertsDonutData: c1?.data?.datasets?.[0]?.data,
            alertsBarData: c2?.data?.datasets?.[0]?.data,
            alertsBarColors: c2?.data?.datasets?.[0]?.backgroundColor,
            revShareDonutSlices: m1?.data?.datasets?.[0]?.data?.length,
            revShareCompareDatasets: m2?.data?.datasets?.length
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Live Deployed Charts Stats:', JSON.stringify(stats.result?.value, null, 2));

  } finally {
    edgeProc.kill('SIGKILL');
  }
}

verifyLive().catch(console.error);
