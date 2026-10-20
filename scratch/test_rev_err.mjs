import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function test() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-err-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9593;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + tmpDir,
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://localhost:' + port + '/json');
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

    const consoleErrors = [];
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const args = (msg.params.args || []).map(a => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
        consoleErrors.push(`[${msg.params.type}] ${args}`);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 4000));

    // Login first
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('loginUsername').value = 'admin';
        document.getElementById('loginPassword').value = 'admin123';
        document.getElementById('btnLoginSubmit').click();
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    console.log('Clicking rev-sharing nav item...');
    await send('Runtime.evaluate', {
      expression: `
        const btn = document.querySelector('.nav-item[data-view="view-collo-rev-sharing"]');
        if (btn) btn.click();
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    console.log('Clicking alerts nav item...');
    await send('Runtime.evaluate', {
      expression: `
        const btn = document.querySelector('.nav-item[data-view="view-collo-alerts"]');
        if (btn) btn.click();
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    console.log('Console logs recorded:');
    console.log(consoleErrors.join('\n'));
    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}
test().catch(console.error);
