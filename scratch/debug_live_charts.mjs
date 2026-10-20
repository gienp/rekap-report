import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-debug-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9577;

  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1536,920',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`http://localhost:${port}/json`);
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page');
    if (!pageTab) throw new Error('Could not find blank page tab');

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
      if (res.exceptionDetails) {
        console.error('Eval error:', res.exceptionDetails);
      }
      return res.result?.value;
    }

    const consoleLogs = [];
    const networkFailures = [];

    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const args = (msg.params.args || []).map(a => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
        consoleLogs.push(`[${msg.params.type}] ${args}`);
      }
      if (msg.method === 'Network.responseReceived') {
        const r = msg.params.response;
        if (r.status >= 400) {
          networkFailures.push(`${r.url} -> ${r.status}`);
        }
      }
    });

    await send('Runtime.enable');
    await send('Network.enable');
    await send('Page.enable');

    console.log('Navigating to https://analytics-811fc.web.app ...');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 4000));

    // Set authenticated user and reload
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
    await new Promise(r => setTimeout(r, 4000));

    console.log('\n--- NETWORK FAILURES (>= 400) ---');
    console.log(networkFailures.length ? networkFailures.join('\n') : 'None');

    console.log('\n--- CONSOLE LOGS ---');
    console.log(consoleLogs.join('\n'));

    const liveStatus = await evaluate(`
      ({
        hasSitacColloData: typeof window.SITAC_COLLO_DATA !== 'undefined',
        sitacRecordsCount: window.SITAC_COLLO_DATA?.sitac_records?.length || 0,
        colloRecordsCount: window.SITAC_COLLO_DATA?.collo_records?.length || 0,
        activeColloText: document.getElementById('execActiveCollo')?.textContent,
        histColloText: document.getElementById('execHistCollo')?.textContent,
        sitacFinishText: document.getElementById('execSitacFinish')?.textContent,
        chartInstancesCount: typeof Chart !== 'undefined' ? Object.keys(Chart.instances).length : 0,
        chartInstanceCanvasIds: typeof Chart !== 'undefined' ? Object.values(Chart.instances).map(c => c.canvas?.id) : [],
        chartTopPengelolaHasInstance: typeof Chart !== 'undefined' && !!document.getElementById('chartTopPengelola') ? !!Chart.getChart(document.getElementById('chartTopPengelola')) : false,
        chartSitacStatusHasInstance: typeof Chart !== 'undefined' && !!document.getElementById('chartSitacStatus') ? !!Chart.getChart(document.getElementById('chartSitacStatus')) : false
      })
    `);

    console.log('\n--- LIVE FIREBASE VALIDATION RESULTS ---');
    console.log(JSON.stringify(liveStatus, null, 2));

    // Capture screenshot
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/live_dashboard_verified.png', Buffer.from(shot.data, 'base64'));
    console.log('\nScreenshot saved to scratch/live_dashboard_verified.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
