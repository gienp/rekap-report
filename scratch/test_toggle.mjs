import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

const port = 9555;
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-toggle-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9556;
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1536,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    });
    await send('Page.navigate', { url: 'http://localhost:' + port + '/index.html' });
    await new Promise(r => setTimeout(r, 2500));

    // Login
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

    // Check theme before click
    const tBefore = await send('Runtime.evaluate', {
      expression: `document.documentElement.getAttribute('data-theme')`,
      returnByValue: true
    });
    console.log('Theme before click:', tBefore.result.value);

    // Click theme button
    const clickRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.getElementById('themeToggleBtn');
          console.log('Btn exists:', !!btn);
          if (btn) btn.click();
          return document.documentElement.getAttribute('data-theme');
        })()
      `,
      returnByValue: true
    });
    console.log('Theme after click:', clickRes.result.value);
    await new Promise(r => setTimeout(r, 1000));

    await send('Runtime.evaluate', {
      expression: `
        (() => {
          window.scrollTo(0, 1000);
          const scrollEl = document.querySelector('.portal-content-body');
          if (scrollEl) scrollEl.scrollTop = 1000;
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1000));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/test_toggle_result_bottom2.png', Buffer.from(shot.data, 'base64'));

    ws.close();
  } finally {
    edgeProc.kill('SIGKILL');
    server.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    process.exit(0);
  }
});
