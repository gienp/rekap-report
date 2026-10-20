import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

const port = 9550;
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-light-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9551;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + cdpPort,
    '--user-data-dir=' + tmpDir,
    '--window-size=1536,1000',
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

    // Login (starts in dark mode)
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

    // Switch to Light Mode via themeToggleBtn click
    await send('Runtime.evaluate', { expression: `document.getElementById('themeToggleBtn')?.click();` });
    await new Promise(r => setTimeout(r, 1500));

    // Capture 1: Executive Overview in Light Mode (Scrolled down to charts)
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.getElementById('chartTopPengelola');
          if (el) el.scrollIntoView({ block: 'center' });
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/verify_view1_exec_light.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved verify_view1_exec_light.png');

    // Capture 2: Alerts View (Monitoring Jatuh Tempo Kontrak)
    await send('Runtime.evaluate', { expression: `document.querySelector('.nav-item[data-view="view-collo-alerts"]')?.click();` });
    await new Promise(r => setTimeout(r, 1500));
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.getElementById('chartAlertsCategoryDonut');
          if (el) el.scrollIntoView({ block: 'center' });
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/verify_view4_alerts_light.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved verify_view4_alerts_light.png');

    // Capture 3: Rev Sharing View
    await send('Runtime.evaluate', { expression: `document.querySelector('.nav-item[data-view="view-collo-rev-sharing"]')?.click();` });
    await new Promise(r => setTimeout(r, 1500));
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.getElementById('chartRevShareMitra');
          if (el) el.scrollIntoView({ block: 'center' });
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/verify_view3_revshare_light.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved verify_view3_revshare_light.png');

    console.log('ALL VERIFICATION SCREENSHOTS SAVED');
    ws.close();
  } finally {
    edgeProc.kill('SIGKILL');
    server.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    process.exit(0);
  }
});
