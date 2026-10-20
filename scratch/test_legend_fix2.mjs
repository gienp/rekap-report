import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-mobile-test-fix2-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9882;
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
      width: 392,
      height: 871,
      deviceScaleFactor: 2.75,
      mobile: true
    });

    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 2000));

    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('loginUsername').value = 'admin';
          document.getElementById('loginPassword').value = 'admin123';
          document.getElementById('btnLoginSubmit')?.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Hide banner for clean view and apply legend fix
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const banner = document.getElementById('dailyContractAlertBanner');
          if (banner) banner.style.display = 'none';
          const toast = document.getElementById('toastContainer');
          if (toast) toast.innerHTML = '';

          const chart = Chart.getChart('chartJenisSewa');
          if (chart) {
            chart.options.plugins.legend.labels.font = { size: 10.5 };
            chart.options.plugins.legend.labels.padding = 8;
            chart.options.plugins.legend.labels.boxWidth = 10;
            const container = document.getElementById('chartJenisSewa')?.parentElement;
            if (container) {
              container.style.height = '330px';
            }
            chart.resize();
            chart.update();
          }
          const el = document.getElementById('chartJenisSewa')?.closest('.pbi-visual-card');
          if (el) el.scrollIntoView({ block: 'center' });
        })()
      `
    });
    await new Promise(r => setTimeout(r, 800));

    const snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'test_legend_fix2.png'), Buffer.from(snap.data, 'base64'));
    console.log('Saved scratch/test_legend_fix2.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
