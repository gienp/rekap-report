import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function inspect() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-inspect-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9596;
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

    // Inspect rev sharing
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.nav-item[data-view="view-collo-rev-sharing"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 1500));

    const revInfo = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const c1 = Chart.getChart('chartRevShareMitra');
          const c2 = Chart.getChart('chartRevShareCompare');
          return {
            c1_legend_display: c1?.options?.plugins?.legend?.display,
            c1_legend_position: c1?.options?.plugins?.legend?.position,
            c1_legend_items: c1?.legend?.legendItems?.map(i => ({ text: i.text, fillStyle: i.fillStyle, hidden: i.hidden })),
            c2_datasets: c2?.data?.datasets?.map(d => ({ label: d.label, data: d.data, bg: d.backgroundColor })),
            c2_legend_items: c2?.legend?.legendItems?.map(i => ({ text: i.text, fillStyle: i.fillStyle })),
            c1_canvas_box: document.getElementById('chartRevShareMitra')?.getBoundingClientRect(),
            c2_canvas_box: document.getElementById('chartRevShareCompare')?.getBoundingClientRect()
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Rev Sharing Charts Info:', JSON.stringify(revInfo.result?.value, null, 2));

    // Inspect alerts
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.nav-item[data-view="view-collo-alerts"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 1500));

    const alertsInfo = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const c1 = Chart.getChart('chartAlertsCategoryDonut');
          const c2 = Chart.getChart('chartAlertsSisaHari');
          return {
            c1_legend_items: c1?.legend?.legendItems?.map(i => ({ text: i.text, fillStyle: i.fillStyle })),
            c1_data: c1?.data?.datasets?.[0]?.data,
            c2_labels: c2?.data?.labels,
            c2_data: c2?.data?.datasets?.[0]?.data,
            c2_colors: c2?.data?.datasets?.[0]?.backgroundColor,
            c1_canvas_box: document.getElementById('chartAlertsCategoryDonut')?.getBoundingClientRect(),
            c2_canvas_box: document.getElementById('chartAlertsSisaHari')?.getBoundingClientRect()
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Alerts Charts Info:', JSON.stringify(alertsInfo.result?.value, null, 2));

  } finally {
    edgeProc.kill('SIGKILL');
  }
}

inspect().catch(console.error);
