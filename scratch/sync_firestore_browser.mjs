import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-sync-fs-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9595;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2500));
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

    console.log('Starting Firestore upload via browser FirebaseManager...');
    const uploadRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          if (!window.FirebaseManager) return { error: 'No FirebaseManager' };
          const db = window.FirebaseManager.getDb();
          if (!db) return { error: 'No db instance' };

          const sitacList = window.SITAC_COLLO_DATA?.sitac_records || [];
          let uploaded = 0;
          const batchSize = 200;

          for (let i = 0; i < sitacList.length; i += batchSize) {
            const chunk = sitacList.slice(i, i + batchSize);
            const batch = db.batch();
            chunk.forEach(s => {
              const ref = db.collection('sitac_records').doc('sitac_' + s.id);
              batch.set(ref, {
                id: s.id,
                no_pa: s.no_pa,
                pelanggan: s.pelanggan,
                ptl: s.ptl,
                pic_perijinan: s.pic_perijinan,
                terminating: s.terminating,
                latitude: s.latitude,
                longitude: s.longitude,
                coord_type: s.coord_type,
                biaya_permintaan_awal: s.biaya_permintaan_awal,
                biaya_final: s.biaya_final,
                efisiensi_rupiah: s.efisiensi_rupiah,
                progress: s.progress,
                date_dispos: s.date_dispos,
                date_close: s.date_close,
                durasi_hari: s.durasi_hari,
                update_pekerjaan: s.update_pekerjaan,
                bulan: s.bulan,
                tahun: s.tahun
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

    console.log('Upload Result to Firestore:', uploadRes.result?.value);
    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
