import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function test() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-srv-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9589;
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

    await send('Page.enable');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 4000));

    const check = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          try {
            const app = firebase.app();
            const delegate = app._getService('firestore', 'default');
            const compatDb = new firebase.firestore.Firestore(app, delegate);
            const snap = await compatDb.collection('summary').doc('executive_summary').get();
            return {
              hasCollection: typeof compatDb.collection === 'function',
              docExists: snap.exists,
              data: snap.data()?.executive
            };
          } catch(e) {
            return { error: e.message, stack: e.stack };
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Compat with delegate test:', check.result?.value);
    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}
test().catch(console.error);
