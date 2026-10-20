import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
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
  const content = fs.readFileSync('index.html', 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(content);
});

server.listen(4900, async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test2-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9589;

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
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      return res.result?.value;
    }

    await send('Runtime.enable');
    await send('Page.enable');

    await send('Page.navigate', { url: 'http://localhost:4900' });
    await new Promise(res => setTimeout(res, 2000));

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
    await new Promise(res => setTimeout(res, 3000));

    // Test switching to SITAC view
    const sitacTest = await evaluate(`
      (async () => {
        const sitacBtn = document.querySelector('.nav-item[data-view="view-sitac-pa"]');
        if (sitacBtn) sitacBtn.click();
        await new Promise(r => setTimeout(r, 1500));
        return {
          sitacTableRows: document.querySelectorAll('#sitacTableBody tr').length,
          sitacTotalBadge: document.getElementById('sitacTotalBadge')?.textContent,
          sitacStatusDetailChart: !!Chart.getChart('chartSitacStatusDetail'),
          sitacAgingChart: !!Chart.getChart('chartSitacAging')
        };
      })()
    `);
    console.log('SITAC View Test:', JSON.stringify(sitacTest, null, 2));

    // Test switching to Collo List view
    const colloTest = await evaluate(`
      (async () => {
        const colloBtn = document.querySelector('.nav-item[data-view="view-collo-list"]');
        if (colloBtn) colloBtn.click();
        await new Promise(r => setTimeout(r, 1500));
        return {
          colloTableRows: document.querySelectorAll('#colloTableBody tr').length,
          colloSummaryText: document.getElementById('colloTableSummaryText')?.textContent,
          colloStatusDistChart: !!Chart.getChart('chartColloStatusDist'),
          colloTopVendorsChart: !!Chart.getChart('chartColloTopVendors')
        };
      })()
    `);
    console.log('Collo View Test:', JSON.stringify(colloTest, null, 2));

    // Test switching to Rekap Efisiensi view
    const effTest = await evaluate(`
      (async () => {
        const effBtn = document.querySelector('.nav-item[data-view="view-efisiensi"]');
        if (effBtn) effBtn.click();
        await new Promise(r => setTimeout(r, 1500));
        return {
          rekapRows: document.querySelectorAll('#rekapEfisiensiTableBody tr').length,
          chartEfisiensiComp: !!Chart.getChart('chartEfisiensiCompare')
        };
      })()
    `);
    console.log('Rekap Efisiensi View Test:', JSON.stringify(effTest, null, 2));

    // Test switching to Gangguan view
    const gTest = await evaluate(`
      (async () => {
        const gBtn = document.querySelector('.nav-item[data-view="view-gangguan"]');
        if (gBtn) gBtn.click();
        await new Promise(r => setTimeout(r, 1500));
        return {
          gangguanRows: document.querySelectorAll('#gangguanTableBody tr').length,
          chartGangguanStatus: !!Chart.getChart('chartGangguanStatus')
        };
      })()
    `);
    console.log('Gangguan View Test:', JSON.stringify(gTest, null, 2));

    ws.close();
  } finally {
    edgeProc.kill();
    server.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
});
