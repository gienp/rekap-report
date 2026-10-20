import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function test() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-charts-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9592;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + tmpDir,
    '--window-size=1536,920',
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

    const consoleLogs = [];
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const args = (msg.params.args || []).map(a => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
        consoleLogs.push(`[${msg.params.type}] ${args}`);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');

    console.log('Navigating to live URL...');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 3000));

    // Fast login
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('loginUsername').value = 'admin';
        document.getElementById('loginPassword').value = 'admin123';
        document.getElementById('btnLoginSubmit').click();
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    // TEST 1: Switch to view-collo-rev-sharing
    console.log('\n--- TESTING VIEW: SKEMA REVENUE SHARING ---');
    await send('Runtime.evaluate', {
      expression: `
        document.querySelector('.nav-item[data-view="view-collo-rev-sharing"]')?.click();
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    const revShareStatus = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const c1 = Chart.getChart('chartRevShareMitra');
          const c2 = Chart.getChart('chartRevShareCompare');
          return {
            totalLinks: document.getElementById('revShareTotalLinks')?.textContent,
            totalRev: document.getElementById('revShareTotalRev')?.textContent,
            totalFee: document.getElementById('revShareTotalFee')?.textContent,
            avgPct: document.getElementById('revShareAvgPct')?.textContent,
            tableRows: document.querySelectorAll('#revShareTableBody tr')?.length,
            chart1_Mitra_Exists: !!c1,
            chart1_Labels: c1?.data?.labels?.length,
            chart2_Compare_Exists: !!c2,
            chart2_Datasets: c2?.data?.datasets?.length
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Rev Sharing Status:', JSON.stringify(revShareStatus.result?.value, null, 2));

    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/view_rev_sharing_verified.png', Buffer.from(shot1.data, 'base64'));
    console.log('Screenshot saved to scratch/view_rev_sharing_verified.png');

    // TEST 2: Switch to view-collo-alerts
    console.log('\n--- TESTING VIEW: JATUH TEMPO KONTRAK (ALERTS) ---');
    await send('Runtime.evaluate', {
      expression: `
        document.querySelector('.nav-item[data-view="view-collo-alerts"]')?.click();
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    const alertsStatus = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const c1 = Chart.getChart('chartAlertsCategoryDonut');
          const c2 = Chart.getChart('chartAlertsSisaHari');
          return {
            countCritical: document.getElementById('countAlertCritical')?.textContent,
            countWarning: document.getElementById('countAlertWarning')?.textContent,
            countSafe: document.getElementById('countAlertSafe')?.textContent,
            countExpired: document.getElementById('countAlertExpired')?.textContent,
            tableRows: document.querySelectorAll('#alertTableBody tr')?.length,
            chart1_CategoryDonut_Exists: !!c1,
            chart1_Data: c1?.data?.datasets?.[0]?.data,
            chart2_SisaHari_Exists: !!c2,
            chart2_Data: c2?.data?.datasets?.[0]?.data
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Alerts Status:', JSON.stringify(alertsStatus.result?.value, null, 2));

    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/view_alerts_verified.png', Buffer.from(shot2.data, 'base64'));
    console.log('Screenshot saved to scratch/view_alerts_verified.png');

    console.log('\n--- BROWSER CONSOLE LOGS ---');
    console.log(consoleLogs.join('\n'));

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

test().catch(console.error);
