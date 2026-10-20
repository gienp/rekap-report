import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-email-save-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9866;
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
          const data = JSON.parse(e.data);
          if (data.id === id) {
            ws.removeEventListener('message', handler);
            if (data.error) reject(data.error);
            else resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 2000));

    // Login as admin
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('loginUsername').value = 'admin';
          document.getElementById('loginPassword').value = 'admin123';
          document.getElementById('btnLoginSubmit')?.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    // Open Admin Modal -> Email Tab
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('btnOpenAdminUsers')?.click();
          window.switchAdminTab('email');
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    // Select 'budi', click auto-suggest, click submit
    const saveResult = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          window.selectAdminEmailUser('budi');
          document.getElementById('btnAdminEmailAutoSuggest')?.click();
          const emailInput = document.getElementById('adminEmailInput');
          const emailVal = emailInput?.value;
          document.getElementById('btnSubmitAdminUpdateEmail')?.click();
          await new Promise(r => setTimeout(r, 1500));
          const alert = document.getElementById('adminEmailAlert');
          return {
            selectedEmail: emailVal,
            alertText: alert?.textContent || '',
            isError: alert?.className?.includes('rose')
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Save Email Result:', saveResult.result.value);

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
