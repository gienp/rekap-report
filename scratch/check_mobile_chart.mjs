import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-mobile-test-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9878;
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
      width: 390,
      height: 844,
      deviceScaleFactor: 2.75,
      mobile: true
    });

    console.log('Navigating to http://localhost:8888 ...');
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
    await new Promise(r => setTimeout(r, 3000));

    // Check charts
    const result = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const sitac = Chart.getChart('chartSitacStatus');
          const jenis = Chart.getChart('chartJenisSewa');
          const exp = Chart.getChart('chartExpirationDonut');
          return {
            sitac: sitac ? {
              labels: sitac.data.labels,
              data: sitac.data.datasets[0].data,
              colors: sitac.data.datasets[0].backgroundColor,
              legendLabels: sitac.legend?.legendItems?.map(i => ({ text: i.text, fill: i.fillStyle }))
            } : null,
            jenis: jenis ? {
              labels: jenis.data.labels,
              data: jenis.data.datasets[0].data,
              colors: jenis.data.datasets[0].backgroundColor,
              legendLabels: jenis.legend?.legendItems?.map(i => ({ text: i.text, fill: i.fillStyle }))
            } : null,
            exp: exp ? {
              labels: exp.data.labels,
              data: exp.data.datasets[0].data,
              colors: exp.data.datasets[0].backgroundColor,
              legendLabels: exp.legend?.legendItems?.map(i => ({ text: i.text, fill: i.fillStyle }))
            } : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Charts Evaluation:', JSON.stringify(result.result.value, null, 2));

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
