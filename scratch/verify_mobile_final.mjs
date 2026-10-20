import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-mobile-final-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9883;
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
    // Exact Xiaomi phone dimensions from user screenshot
    await send('Emulation.setDeviceMetricsOverride', {
      width: 392,
      height: 871,
      deviceScaleFactor: 2.75,
      mobile: true
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

    // Dismiss floating notification banner for unobstructed screenshot
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const banner = document.getElementById('dailyContractAlertBanner');
          if (banner) banner.style.display = 'none';
          const toast = document.getElementById('toastContainer');
          if (toast) toast.innerHTML = '';
          const el = document.getElementById('chartJenisSewa')?.closest('.pbi-visual-card');
          if (el) el.scrollIntoView({ block: 'center' });
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    // Get rendered legend items from Chart instance
    const check = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const chart = Chart.getChart('chartJenisSewa');
          return {
            legendItems: chart?.legend?.legendItems?.map(i => ({ text: i.text, fill: i.fillStyle })),
            height: document.getElementById('chartJenisSewa')?.parentElement?.clientHeight
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Result:', JSON.stringify(check.result.value, null, 2));

    const snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'mobile_jenis_sewa_fixed.png'), Buffer.from(snap.data, 'base64'));
    console.log('Saved scratch/mobile_jenis_sewa_fixed.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
