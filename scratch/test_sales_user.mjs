import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-sales-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9896;
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

    let id = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const msgId = id++;
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === msgId) {
          ws.removeEventListener('message', handler);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Preset user as sales
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        localStorage.setItem('telecom_portal_user', JSON.stringify({
          id: 14,
          username: 'sales',
          full_name: 'Tim Sales / Account Executive',
          role: 'sales',
          email: 'sales@telecom.ops'
        }));
      `
    });

    console.log('Navigating to http://localhost:8888 ...');
    await send('Page.navigate', { url: 'http://localhost:8888' });
    await new Promise(r => setTimeout(r, 3000));

    // Check DOM state
    const { result } = await send('Runtime.evaluate', {
      expression: `
        (() => {
          return {
            bodyClass: document.body.className,
            nameDisplay: document.getElementById('userNameDisplay')?.textContent,
            roleDisplay: document.getElementById('userRoleDisplay')?.textContent,
            roleClass: document.getElementById('userRoleDisplay')?.className,
            roleIcon: document.getElementById('userRoleIcon')?.className,
            avatarBox: document.getElementById('userRoleAvatar')?.className,
            groupColloDisplay: document.getElementById('groupCollo')?.style.display,
            adminUsersBtnHidden: document.getElementById('btnOpenAdminUsers')?.classList.contains('hidden'),
            deleteBtnCount: document.querySelectorAll('.btn-delete-row:not([style*="display: none"])').length
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Sales user state in DOM:', result.value);

    const artifactDir = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'sales_user_logged_in.png'), Buffer.from(data, 'base64'));
    console.log('Saved sales_user_logged_in.png');

    ws.close();
  } finally {
    edgeProc.kill('SIGKILL');
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    console.log('Verification finished.');
  }
}

main().catch(console.error);
