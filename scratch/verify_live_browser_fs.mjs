import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-live-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9585;
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

    const checkResult = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          try {
            const hasFb = !!window.FirebaseManager;
            const isCfg = window.FirebaseManager?.isConfigured();
            const conn = await window.FirebaseManager?.testConnection();
            
            let userCount = 0;
            let sitacCount = 0;
            try {
              const users = await window.FirebaseManager.fetchCollection('users');
              userCount = users.length;
            } catch(e) {}

            try {
              const sitac = await window.FirebaseManager.fetchCollection('sitac_records');
              sitacCount = sitac.length;
            } catch(e) {}

            return {
              hasFirebaseManager: hasFb,
              isConfigured: isCfg,
              testConnectionResult: conn,
              liveUsersFromFirestore: userCount,
              liveSitacFromFirestore: sitacCount
            };
          } catch(e) {
            return { error: e.message };
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('\n=== LIVE FIRESTORE IN-BROWSER VALIDATION ===');
    console.log(JSON.stringify(checkResult.result?.value, null, 2));

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
