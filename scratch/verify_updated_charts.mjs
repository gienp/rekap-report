import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

// 1. Static HTTP Server
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const fp = path.join(process.cwd(), p);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
    const ext = path.extname(fp);
    const mime = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : ext === '.json' ? 'application/json' : 'text/plain';
    res.writeHead(200, { 'Content-Type': mime, 'Access-Control-Allow-Origin': '*' });
    res.end(fs.readFileSync(fp));
  } else {
    res.writeHead(404);
    res.end('Not found: ' + p);
  }
});

server.listen(8089, async () => {
  console.log('Static server started on http://localhost:8089');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-charts-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9599;
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
    await send('Page.navigate', { url: 'http://localhost:8089' });
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

    // 1. REV SHARING
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.nav-item[data-view="view-collo-rev-sharing"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 1500));

    const imgRevMitra = await send('Runtime.evaluate', {
      expression: `document.getElementById('chartRevShareMitra')?.toDataURL('image/png')`
    });
    if (imgRevMitra.result?.value) {
      fs.writeFileSync('scratch/canvas_rev_share_mitra_updated.png', Buffer.from(imgRevMitra.result.value.replace(/^data:image\/png;base64,/, ''), 'base64'));
    }

    const imgRevCompare = await send('Runtime.evaluate', {
      expression: `document.getElementById('chartRevShareCompare')?.toDataURL('image/png')`
    });
    if (imgRevCompare.result?.value) {
      fs.writeFileSync('scratch/canvas_rev_share_compare_updated.png', Buffer.from(imgRevCompare.result.value.replace(/^data:image\/png;base64,/, ''), 'base64'));
    }

    // 2. ALERTS
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.nav-item[data-view="view-collo-alerts"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 1500));

    const imgAlertDonut = await send('Runtime.evaluate', {
      expression: `document.getElementById('chartAlertsCategoryDonut')?.toDataURL('image/png')`
    });
    if (imgAlertDonut.result?.value) {
      fs.writeFileSync('scratch/canvas_alerts_donut_updated.png', Buffer.from(imgAlertDonut.result.value.replace(/^data:image\/png;base64,/, ''), 'base64'));
    }

    const imgAlertBar = await send('Runtime.evaluate', {
      expression: `document.getElementById('chartAlertsSisaHari')?.toDataURL('image/png')`
    });
    if (imgAlertBar.result?.value) {
      fs.writeFileSync('scratch/canvas_alerts_bar_updated.png', Buffer.from(imgAlertBar.result.value.replace(/^data:image\/png;base64,/, ''), 'base64'));
    }

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
            alertsBarLabels: c2?.data?.labels,
            revShareDonutSlices: m1?.data?.datasets?.[0]?.data?.length,
            revShareCompareDatasets: m2?.data?.datasets?.length
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Updated Charts Stats:', JSON.stringify(stats.result?.value, null, 2));

  } finally {
    edgeProc.kill('SIGKILL');
    server.close();
  }
});
