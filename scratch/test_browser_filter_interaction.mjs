import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-filter-ui-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9885;
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
      width: 1400,
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

    // Function to get current badges & chart status
    async function getDashboardState() {
      const evalRes = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const chartJenis = Chart.getChart('chartJenisSewa');
            const chartSitac = Chart.getChart('chartSitacStatus');
            const chartTrend = Chart.getChart('chartMonthlyTrend');
            const chartEff = Chart.getChart('chartEfisiensiTahunan');
            return {
              badgeJenis: document.getElementById('badgeJenisSewa')?.textContent,
              badgeSitac: document.getElementById('badgeSitacStatus')?.textContent,
              badgeTopP: document.getElementById('badgeTopPengelola')?.textContent,
              badgeTrend: document.getElementById('badgeMonthlyTrend')?.textContent,
              badgeEff: document.getElementById('badgeEfisiensiVisual')?.textContent,
              titleEff: document.getElementById('titleEfisiensiVisual')?.textContent,
              jenisData: chartJenis?.data?.datasets?.[0]?.data,
              jenisLabels: chartJenis?.data?.labels,
              sitacData: chartSitac?.data?.datasets?.[0]?.data,
              trendLabels: chartTrend?.data?.labels,
              effLabels: chartEff?.data?.labels
            };
          })()
        `,
        returnByValue: true
      });
      return evalRes.result.value;
    }

    console.log('--- Initial (ALL) ---');
    console.log(await getDashboardState());

    // Click 2025 pill
    console.log('--- Clicking Pill 2025 ---');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pill = document.querySelector('#execPeriodQuickPills button[data-period="2025"]');
          pill?.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));
    console.log(await getDashboardState());

    // Click 2026 pill
    console.log('--- Clicking Pill 2026 ---');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pill = document.querySelector('#execPeriodQuickPills button[data-period="2026"]');
          pill?.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));
    console.log(await getDashboardState());

    // Click 2024 pill
    console.log('--- Clicking Pill 2024 ---');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pill = document.querySelector('#execPeriodQuickPills button[data-period="2024"]');
          pill?.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));
    console.log(await getDashboardState());

    // Click Semua Periode
    console.log('--- Clicking Pill ALL ---');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pill = document.querySelector('#execPeriodQuickPills button[data-period="ALL"]');
          pill?.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));
    console.log(await getDashboardState());

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
