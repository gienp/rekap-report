import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const modifiedJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scratch', 'modified_casing_collo.json'), 'utf-8'));
  console.log(`Loaded ${modifiedJson.length} modified casing collo records to sync to Firestore.`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-sync-collo-casing-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9609;
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

    await send('Page.enable');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 4500));

    console.log('Pushing modified records to browser context...');
    await send('Runtime.evaluate', {
      expression: `window.__MODIFIED_COLLO = ${JSON.stringify(modifiedJson)};`
    });

    console.log('Updating Firestore collo_records collection in batches of 100...');
    const uploadRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          if (!window.FirebaseManager) return { error: 'No FirebaseManager' };
          const db = window.FirebaseManager.getDb();
          if (!db) return { error: 'No db instance' };

          const records = window.__MODIFIED_COLLO || [];
          let uploaded = 0;
          const batchSize = 100;

          for (let i = 0; i < records.length; i += batchSize) {
            const chunk = records.slice(i, i + batchSize);
            const batch = db.batch();
            chunk.forEach(c => {
              const ref = db.collection('collo_records').doc('collo_' + c.id);
              // Update only normalized fields to be fast and safe
              batch.set(ref, {
                jenis_sewa: c.jenis_sewa,
                pengelola: c.pengelola,
                metode_kerjasama: c.metode_kerjasama
              }, { merge: true });
            });
            await batch.commit();
            uploaded += chunk.length;
          }

          return { success: true, uploaded: uploaded };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Firestore Sync Result:', uploadRes.result?.value);
    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
