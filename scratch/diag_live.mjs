import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-live-diag-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9586;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`http://localhost:${port}/json`);
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

    const consoleLogs = [];
    const scriptUrls = [];
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const args = (msg.params.args || []).map(a => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
        consoleLogs.push(`[${msg.params.type}] ${args}`);
      }
      if (msg.method === 'Debugger.scriptParsed') {
        if (msg.params.url) scriptUrls.push(msg.params.url);
      }
    });

    await send('Runtime.enable');
    await send('Debugger.enable');
    await send('Page.enable');

    console.log('Navigating to live URL...');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 4000));

    console.log('Loaded scripts from page:');
    scriptUrls.filter(u => u.includes('.js')).forEach(u => console.log(' -', u));

    const diag = await send('Runtime.evaluate', {
      expression: `
        (() => {
          return {
            fbConfigVer: document.querySelector('script[src*="firebase-config"]')?.src,
            appVer: document.querySelector('script[src*="app.js"]')?.src,
            isFirebaseDefined: typeof firebase !== 'undefined',
            firebaseAppsCount: typeof firebase !== 'undefined' ? firebase.apps.length : 0,
            hasFirebaseManager: typeof window.FirebaseManager !== 'undefined',
            isConfigured: window.FirebaseManager?.isConfigured?.()
          };
        })()
      `,
      returnByValue: true
    });

    console.log('\nDiagnostic:', JSON.stringify(diag.result?.value, null, 2));

    console.log('\nTesting login with admin/admin123...');
    const t0 = Date.now();
    const loginTest = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          try {
            const u = await window.FirebaseManager.loginUser('admin', 'admin123');
            return { success: true, user: u };
          } catch(e) {
            return { success: false, error: e.message };
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log(`Login result (${Date.now() - t0} ms):`, loginTest.result?.value);

    console.log('\nConsole logs:');
    console.log(consoleLogs.join('\n'));

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
