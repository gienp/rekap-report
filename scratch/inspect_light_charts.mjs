import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

const port = 9524;
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-light-charts-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9525;
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
      return new Promise((resolve) => {
        const id = msgId++;
        const handler = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.id === id) {
            ws.removeEventListener('message', handler);
            resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Runtime.enable');
    await send('Page.enable');

    await send('Page.navigate', { url: 'http://localhost:' + port + '/index.html' });
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

    // Switch to light mode
    console.log('Toggling theme to light mode...');
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('themeToggleBtn')?.click();
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Capture Executive view in light mode
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/light_mode_exec_top.png', Buffer.from(shot.data, 'base64'));

    // Scroll down to see Executive charts
    await send('Runtime.evaluate', {
      expression: `window.scrollTo(0, 800);`
    });
    await new Promise(r => setTimeout(r, 1000));
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/light_mode_exec_charts.png', Buffer.from(shot.data, 'base64'));

    // Switch to view-collo-alerts
    console.log('Switching to view-collo-alerts in light mode...');
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.nav-item[data-view="view-collo-alerts"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 2000));

    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/light_mode_alerts_charts.png', Buffer.from(shot.data, 'base64'));

    console.log('All light mode screenshots captured successfully!');
    ws.close();
  } catch (err) {
    console.error(err);
  } finally {
    edgeProc.kill('SIGKILL');
    server.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    process.exit(0);
  }
});
