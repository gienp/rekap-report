import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function test() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-args-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9588;
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
        (() => {
          const results = {};
          try {
            const db1 = firebase.firestore(firebase.app(), 'default');
            results.t1 = db1._databaseId?.database || db1._delegate?._databaseId?.database;
          } catch(e) { results.t1_err = e.message; }

          try {
            const db2 = firebase.app().firestore('default');
            results.t2 = db2._databaseId?.database || db2._delegate?._databaseId?.database;
          } catch(e) { results.t2_err = e.message; }

          results.appFirestoreToString = firebase.app().firestore.toString();
          return results;
        })()
      `,
      returnByValue: true
    });

    console.log('Results:', check.result?.value);
    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}
test().catch(console.error);
