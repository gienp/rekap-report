import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-harlan-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9579;

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

    await send('Runtime.enable');
    await send('Network.enable');
    await send('Page.enable');

    console.log('Navigating to live Firebase URL: https://analytics-811fc.web.app ...');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 3000));

    await evaluate(`
      localStorage.clear();
      location.reload();
    `);
    await new Promise(r => setTimeout(r, 3000));

    console.log('Filling technician credentials: harlan / pic123...');
    const loginStartTime = Date.now();
    await evaluate(`
      document.getElementById('loginUsername').value = 'harlan';
      document.getElementById('loginPassword').value = 'pic123';
      document.getElementById('btnLoginSubmit').click();
    `);

    let loggedIn = false;
    let elapsed = 0;
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 100));
      elapsed = Date.now() - loginStartTime;
      const overlayHidden = await evaluate(`
        document.getElementById('loginOverlay')?.style.display === 'none'
      `);
      if (overlayHidden) {
        loggedIn = true;
        break;
      }
    }

    console.log(`\n=== HARLAN LOGIN PERFORMANCE RESULTS ===`);
    console.log(`Login Succeeded: ${loggedIn}`);
    console.log(`Time taken to authenticate & enter portal: ${elapsed} ms`);

    const appState = await evaluate(`
      ({
        userName: document.getElementById('userNameDisplay')?.textContent,
        userRole: document.getElementById('userRoleDisplay')?.textContent,
        activeView: window.state?.activeView,
        lockedPicBadge: document.getElementById('lockedPicBadgeName')?.textContent
      })
    `);
    console.log('App state after login:', JSON.stringify(appState, null, 2));

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
