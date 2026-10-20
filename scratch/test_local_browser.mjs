import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

// Create a static web server without /api (exactly like Firebase Hosting)
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  
  // If request is an API request and server has no backend:
  // Firebase rewrite sends /index.html with status 200:
  if (reqPath.startsWith('/api/')) {
    const content = fs.readFileSync('index.html', 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(content);
  }

  const filePath = path.join(process.cwd(), reqPath.slice(1));
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    let ct = 'text/plain';
    if (filePath.endsWith('.html')) ct = 'text/html';
    else if (filePath.endsWith('.js')) ct = 'application/javascript';
    else if (filePath.endsWith('.css')) ct = 'text/css';
    else if (filePath.endsWith('.json')) ct = 'application/json';
    res.writeHead(200, { 'Content-Type': ct });
    return res.end(fs.readFileSync(filePath));
  }

  // Rewrite fallback
  const content = fs.readFileSync('index.html', 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(content);
});

server.listen(4899, async () => {
  console.log('Static test server listening on port 4899 (simulating Firebase Hosting)');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9588;

  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1536,920',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const r = await fetch(`http://localhost:${cdpPort}/json`);
    const tabs = await r.json();
    const pageTab = tabs.find(t => t.type === 'page');

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

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

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true });
      if (res.exceptionDetails) {
        console.error('Eval exception:', res.exceptionDetails);
      }
      return res.result?.value;
    }

    const consoleLogs = [];
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const args = (msg.params.args || []).map(a => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
        consoleLogs.push(`[${msg.params.type}] ${args}`);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');

    console.log('Navigating to http://localhost:4899 ...');
    await send('Page.navigate', { url: 'http://localhost:4899' });
    await new Promise(res => setTimeout(res, 4000));

    // Auto-login as Admin or check state
    await evaluate(`
      localStorage.setItem('telecom_portal_user', JSON.stringify({
        username: 'admin',
        full_name: 'Administrator (Manajemen)',
        role: 'admin',
        avatar_icon: 'fa-shield-halved',
        badge_color: 'cyan',
        pic_code: ''
      }));
    `);
    await send('Page.reload');
    await new Promise(res => setTimeout(res, 4000));

    console.log('\n--- BROWSER CONSOLE LOGS ---');
    console.log(consoleLogs.join('\n'));

    const check = await evaluate(`
      ({
        hasSitacColloData: typeof window.SITAC_COLLO_DATA !== 'undefined',
        sitacRecordsCount: window.SITAC_COLLO_DATA?.sitac_records?.length || 0,
        colloRecordsCount: window.SITAC_COLLO_DATA?.collo_records?.length || 0,
        activeColloText: document.getElementById('execActiveCollo')?.textContent,
        histColloText: document.getElementById('execHistCollo')?.textContent,
        sitacFinishText: document.getElementById('execSitacFinish')?.textContent,
        chartTopPengelolaExists: !!document.getElementById('chartTopPengelola'),
        chartInstancesCount: typeof Chart !== 'undefined' ? Object.keys(Chart.instances).length : 0,
        chartInstanceCanvasIds: typeof Chart !== 'undefined' ? Object.values(Chart.instances).map(c => c.canvas?.id) : [],
        chartTopPengelolaByElement: typeof Chart !== 'undefined' && !!document.getElementById('chartTopPengelola') ? !!Chart.getChart(document.getElementById('chartTopPengelola')) : false,
      })
    `);

    console.log('\n--- VALIDATION RESULTS ---');
    console.log(JSON.stringify(check, null, 2));

    ws.close();
  } finally {
    edgeProc.kill();
    server.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
});
