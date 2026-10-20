import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-login-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9578;

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
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const args = (msg.params.args || []).map(a => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
        consoleLogs.push(`[${msg.params.type}] ${args}`);
      }
    });

    await send('Runtime.enable');
    await send('Network.enable');
    await send('Page.enable');

    console.log('Navigating to live Firebase URL: https://analytics-811fc.web.app ...');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 3000));

    // Ensure session is logged out
    await evaluate(`
      localStorage.clear();
      location.reload();
    `);
    await new Promise(r => setTimeout(r, 3000));

    // Check if login overlay is visible
    const isOverlayVisible = await evaluate(`
      document.getElementById('loginOverlay')?.style.display !== 'none'
    `);
    console.log('Login overlay visible before login:', isOverlayVisible);

    // Fill form and click submit
    console.log('Filling login credentials: admin / admin123...');
    const loginStartTime = Date.now();
    await evaluate(`
      document.getElementById('loginUsername').value = 'admin';
      document.getElementById('loginPassword').value = 'admin123';
      document.getElementById('btnLoginSubmit').click();
    `);

    // Poll until overlay is hidden or timeout 5s
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

    console.log(`\n=== LOGIN PERFORMANCE RESULTS ===`);
    console.log(`Login Succeeded: ${loggedIn}`);
    console.log(`Time taken to authenticate & enter portal: ${elapsed} ms`);

    const appState = await evaluate(`
      ({
        userName: document.getElementById('userNameDisplay')?.textContent,
        userRole: document.getElementById('userRoleDisplay')?.textContent,
        activeView: window.state?.activeView,
        chartCount: typeof Chart !== 'undefined' ? Object.keys(Chart.instances).length : 0,
        toastCount: document.querySelectorAll('.toast-alert')?.length
      })
    `);
    console.log('App state after login:', JSON.stringify(appState, null, 2));

    // Capture screenshot
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/live_login_verified.png', Buffer.from(shot.data, 'base64'));
    console.log('Screenshot saved to scratch/live_login_verified.png');

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
