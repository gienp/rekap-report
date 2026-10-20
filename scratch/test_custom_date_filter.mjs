import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-filter-custom-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9888;
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

    // Select CUSTOM
    console.log('--- Applying Custom Date Range (2025-01-01 to 2025-06-30) ---');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const sel = document.getElementById('execFilterPeriod');
          sel.value = 'CUSTOM';
          sel.dispatchEvent(new Event('change'));
          document.getElementById('execDateStart').value = '2025-01-01';
          document.getElementById('execDateEnd').value = '2025-06-30';
          document.getElementById('btnApplyExecCustomDate')?.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    const customState = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const chartJenis = Chart.getChart('chartJenisSewa');
          const chartSitac = Chart.getChart('chartSitacStatus');
          const chartTrend = Chart.getChart('chartMonthlyTrend');
          return {
            badgeJenis: document.getElementById('badgeJenisSewa')?.textContent,
            badgeSitac: document.getElementById('badgeSitacStatus')?.textContent,
            badgeTrend: document.getElementById('badgeMonthlyTrend')?.textContent,
            sitacData: chartSitac?.data?.datasets?.[0]?.data,
            trendLabels: chartTrend?.data?.labels
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Custom filter result:', customState.result.value);
    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
