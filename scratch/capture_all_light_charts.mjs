import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

const port = 9530;
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(process.cwd(), decodeURIComponent(reqPath));
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(filePath).toLowerCase();
  const mimes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
  res.writeHead(200, { 'Content-Type': mimes[ext] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-all-light-charts-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9531;
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

    // Login and set light theme
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          localStorage.setItem('portal_theme', 'light');
          document.getElementById('loginUsername').value = 'admin';
          document.getElementById('loginPassword').value = 'admin123';
          document.getElementById('btnLoginSubmit').click();
          const alertBanner = document.getElementById('dailyContractAlertBanner');
          if (alertBanner) alertBanner.style.display = 'none';
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2500));

    // Ensure light theme is active by clicking themeToggleBtn
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.getElementById('themeToggleBtn');
          if (btn) btn.click();
          return document.documentElement.getAttribute('data-theme');
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    async function snapElement(selector, filename) {
      const clip = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const el = document.querySelector('${selector}');
            if (!el) return null;
            el.scrollIntoView({ block: 'center', inline: 'center' });
            const rect = el.getBoundingClientRect();
            return { x: rect.left, y: rect.top, width: rect.width, height: rect.height, scale: 1 };
          })()
        `,
        returnByValue: true
      });
      await new Promise(r => setTimeout(r, 400));
      if (clip.result.value && clip.result.value.width > 0 && clip.result.value.height > 0) {
        // re-get rect after scroll
        const rectAfter = await send('Runtime.evaluate', {
          expression: `
            (() => {
              const el = document.querySelector('${selector}');
              const rect = el.getBoundingClientRect();
              return { x: Math.max(0, rect.left), y: Math.max(0, rect.top), width: rect.width, height: rect.height, scale: 1 };
            })()
          `,
          returnByValue: true
        });
        const shot = await send('Page.captureScreenshot', { format: 'png', clip: rectAfter.result.value });
        fs.writeFileSync(path.join(process.cwd(), 'scratch', filename), Buffer.from(shot.data, 'base64'));
        console.log('Snapped ' + selector + ' -> ' + filename);
      } else {
        console.log('Element not found or zero size: ' + selector);
      }
    }

    // 1. Executive Summary Charts
    await snapElement('#chartTopPengelola', 'snap_exec_pengelola.png');
    await snapElement('#chartSitacStatus', 'snap_exec_sitac.png');
    await snapElement('#chartJenisSewa', 'snap_exec_jenis.png');
    await snapElement('#chartExpirationDonut', 'snap_exec_exp.png');
    await snapElement('#chartMonthlyTrend', 'snap_exec_trend.png');
    await snapElement('#chartEfisiensiTahunan', 'snap_exec_eff_annual.png');

    // 2. Rev Sharing
    await send('Runtime.evaluate', { expression: `document.querySelector('.nav-item[data-view="view-collo-rev-sharing"]')?.click();` });
    await new Promise(r => setTimeout(r, 1500));
    await snapElement('#chartRevShareMitra', 'snap_rev_mitra.png');
    await snapElement('#chartRevShareCompare', 'snap_rev_compare.png');

    // 3. Alerts
    await send('Runtime.evaluate', { expression: `document.querySelector('.nav-item[data-view="view-collo-alerts"]')?.click();` });
    await new Promise(r => setTimeout(r, 1500));
    await snapElement('#chartAlertsCategoryDonut', 'snap_alerts_donut.png');
    await snapElement('#chartAlertsSisaHari', 'snap_alerts_bar.png');

    // 4. SITAC PA
    await send('Runtime.evaluate', { expression: `document.querySelector('.nav-item[data-view="view-sitac-pa"]')?.click();` });
    await new Promise(r => setTimeout(r, 1500));
    await snapElement('#chartSitacAging', 'snap_sitac_aging.png');
    await snapElement('#chartSitacStatusDetail', 'snap_sitac_detail.png');

    // 5. Efisiensi
    await send('Runtime.evaluate', { expression: `document.querySelector('.nav-item[data-view="view-efisiensi"]')?.click();` });
    await new Promise(r => setTimeout(r, 1500));
    await snapElement('#chartEfisiensiCompare', 'snap_eff_compare.png');
    await snapElement('#chartEfisiensiPct', 'snap_eff_pct.png');

    // 6. PIC Matrix
    await send('Runtime.evaluate', { expression: `document.querySelector('.nav-item[data-view="view-pic-matrix"]')?.click();` });
    await new Promise(r => setTimeout(r, 1500));
    await snapElement('#chartPicWorkload', 'snap_pic_workload.png');
    await snapElement('#chartPicFinishRate', 'snap_pic_rate.png');

    console.log('ALL CHARTS SNAPPED SUCCESSFULLY');
    ws.close();
  } finally {
    edgeProc.kill('SIGKILL');
    server.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    process.exit(0);
  }
});
