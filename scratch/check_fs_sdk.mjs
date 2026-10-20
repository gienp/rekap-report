import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-fs-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9583;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    'https://analytics-811fc.web.app'
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

    await send('Page.enable');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 4000));

    const evalRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          try {
            const app = firebase.app();
            let dbDefault = null;
            let errDefault = null;
            try {
              // Try getting named database
              dbDefault = firebase.app().firestore('default');
            } catch (e) {
              errDefault = e.message;
            }
            
            let readResult = null;
            let readErr = null;
            try {
              const snap = await dbDefault.collection('_health_check').doc('ping').get();
              readResult = snap.exists ? snap.data() : 'not_found';
            } catch (e) {
              readErr = e.message;
            }

            return {
              appExists: !!app,
              errDefault: errDefault,
              readResult: readResult,
              readErr: readErr
            };
          } catch(e) {
            return { error: e.message };
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Result:', evalRes.result?.value);
    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}
main().catch(console.error);
