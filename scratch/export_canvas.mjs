import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

const port = 9535;
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(process.cwd(), decodeURIComponent(reqPath));
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(filePath).toLowerCase();
  const mimes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
  res.writeHead(200, { 'Content-Type': mimes[ext] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-canvas-dataurl-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9536;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + cdpPort,
    '--user-data-dir=' + tmpDir,
    '--window-size=1536,1200',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://localhost:' + cdpPort + '/json');
    const tabs = await res.json();
    const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
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

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: 'http://localhost:' + port + '/index.html' });
    await new Promise(r => setTimeout(r, 2500));

    // Login and toggle to light mode
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('loginUsername').value = 'admin';
          document.getElementById('loginPassword').value = 'admin123';
          document.getElementById('btnLoginSubmit').click();
          const alertBanner = document.getElementById('dailyContractAlertBanner');
          if (alertBanner) alertBanner.style.display = 'none';
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Toggle theme to light
    const themeResult = await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('themeToggleBtn')?.click();
          return document.documentElement.getAttribute('data-theme');
        })()
      `,
      returnByValue: true
    });
    console.log('Current theme after toggle:', themeResult.result.value);
    await new Promise(r => setTimeout(r, 1500));

    async function saveCanvas(canvasId, filename) {
      const dataUrlRes = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const c = document.getElementById('${canvasId}');
            if (!c) return { err: 'not_found' };
            return { dataUrl: c.toDataURL('image/png') };
          })()
        `,
        returnByValue: true
      });
      const val = dataUrlRes.result.value;
      if (val?.dataUrl) {
        const base64Data = val.dataUrl.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(path.join(process.cwd(), 'scratch', filename), Buffer.from(base64Data, 'base64'));
        console.log('Saved canvas ' + canvasId + ' -> ' + filename);
      } else {
        console.log('Canvas ' + canvasId + ' failed: ' + JSON.stringify(val));
      }
    }

    // 1. Executive
    await saveCanvas('chartTopPengelola', 'canvas_exec_pengelola.png');
    await saveCanvas('chartSitacStatus', 'canvas_exec_sitac.png');
    await saveCanvas('chartJenisSewa', 'canvas_exec_jenis.png');
    await saveCanvas('chartExpirationDonut', 'canvas_exec_exp.png');
    await saveCanvas('chartMonthlyTrend', 'canvas_exec_trend.png');
    await saveCanvas('chartEfisiensiTahunan', 'canvas_exec_eff_annual.png');

    // 2. Rev sharing
    await send('Runtime.evaluate', { expression: `document.querySelector('.nav-item[data-view="view-collo-rev-sharing"]')?.click();` });
    await new Promise(r => setTimeout(r, 1500));
    await saveCanvas('chartRevShareMitra', 'canvas_rev_mitra.png');
    await saveCanvas('chartRevShareCompare', 'canvas_rev_compare.png');

    // 3. Alerts
    await send('Runtime.evaluate', { expression: `document.querySelector('.nav-item[data-view="view-collo-alerts"]')?.click();` });
    await new Promise(r => setTimeout(r, 1500));
    await saveCanvas('chartAlertsCategoryDonut', 'canvas_alerts_donut.png');
    await saveCanvas('chartAlertsSisaHari', 'canvas_alerts_bar.png');

    // 4. Efisiensi
    await send('Runtime.evaluate', { expression: `document.querySelector('.nav-item[data-view="view-efisiensi"]')?.click();` });
    await new Promise(r => setTimeout(r, 1500));
    await saveCanvas('chartEfisiensiCompare', 'canvas_eff_compare.png');
    await saveCanvas('chartEfisiensiPct', 'canvas_eff_pct.png');

    // 5. PIC Matrix
    await send('Runtime.evaluate', { expression: `document.querySelector('.nav-item[data-view="view-pic-matrix"]')?.click();` });
    await new Promise(r => setTimeout(r, 1500));
    await saveCanvas('chartPicWorkload', 'canvas_pic_workload.png');
    await saveCanvas('chartPicFinishRate', 'canvas_pic_rate.png');

    // Capture whole window screenshot too
    const fullShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/full_window_light.png', Buffer.from(fullShot.data, 'base64'));
    console.log('ALL CANVASES DUMPED SUCCESSFULLY');

    ws.close();
  } finally {
    edgeProc.kill('SIGKILL');
    server.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    process.exit(0);
  }
});
