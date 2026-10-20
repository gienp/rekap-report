import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

const port = 9520;
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(process.cwd(), decodeURIComponent(reqPath));
  
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };
  
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, async () => {
  console.log(`Test server running at http://localhost:${port}`);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-alert-test-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9521;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + cdpPort,
    '--user-data-dir=' + tmpDir,
    '--window-size=1536,920',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`http://localhost:${cdpPort}/json`);
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
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

    console.log('Navigating to local index.html...');
    await send('Page.navigate', { url: `http://localhost:${port}/index.html` });
    await new Promise(r => setTimeout(r, 3000));

    // Fast login
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('loginUsername').value = 'admin';
        document.getElementById('loginPassword').value = 'admin123';
        document.getElementById('btnLoginSubmit').click();
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    // Check nav badge before clicking
    const navBadgeBefore = await send('Runtime.evaluate', {
      expression: `document.getElementById('badgeNavCriticalAlerts')?.textContent`,
      returnByValue: true
    });
    console.log('Nav Badge before click:', navBadgeBefore.result?.value);

    // Click "Jatuh Tempo Kontrak"
    console.log('Clicking Jatuh Tempo Kontrak nav item...');
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.nav-item[data-view="view-collo-alerts"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 2000));

    // Check alerts state (Active)
    const activeCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          return {
            navBadge: document.getElementById('badgeNavCriticalAlerts')?.textContent,
            countCritical: document.getElementById('countAlertCritical')?.textContent,
            countWarning: document.getElementById('countAlertWarning')?.textContent,
            countSafe: document.getElementById('countAlertSafe')?.textContent,
            countExpired: document.getElementById('countAlertExpired')?.textContent,
            tableTitle: document.getElementById('alertTableTitle')?.textContent,
            tableRows: document.querySelectorAll('#alertTableBody tr')?.length,
            selectedStatus: document.getElementById('alertStatusFilter')?.value
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Active Alerts State:', JSON.stringify(activeCheck.result?.value, null, 2));

    const shotActive = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/view_alerts_active_verification.png', Buffer.from(shotActive.data, 'base64'));
    console.log('Active screenshot saved to scratch/view_alerts_active_verification.png');

    // Now test status filter switch to "ALL"
    console.log('Switching Status Filter to ALL...');
    await send('Runtime.evaluate', {
      expression: `
        const sel = document.getElementById('alertStatusFilter');
        sel.value = 'ALL';
        sel.dispatchEvent(new Event('change'));
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    const allCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          return {
            countCritical: document.getElementById('countAlertCritical')?.textContent,
            tableTitle: document.getElementById('alertTableTitle')?.textContent,
            tableRows: document.querySelectorAll('#alertTableBody tr')?.length,
            selectedStatus: document.getElementById('alertStatusFilter')?.value
          };
        })()
      `,
      returnByValue: true
    });
    console.log('ALL Alerts State:', JSON.stringify(allCheck.result?.value, null, 2));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/view_alerts_fixed_verification.png', Buffer.from(shot.data, 'base64'));
    console.log('Screenshot saved to scratch/view_alerts_fixed_verification.png');

    ws.close();
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    edgeProc.kill('SIGKILL');
    server.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    process.exit(0);
  }
});
