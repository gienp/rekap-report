import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-charts-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9555;

  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1536,920',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`http://localhost:${port}/json`);
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page');
    if (!pageTab) throw new Error('Could not find blank page tab');

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

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

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true });
      return res.result?.value;
    }

    async function captureScreenshot(filepath) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
      console.log('Saved screenshot to:', filepath);
    }

    await send('Page.enable');
    await send('Page.navigate', { url: 'http://localhost:8888' });
    await new Promise(r => setTimeout(r, 3000));

    // 1. Executive overview charts
    await captureScreenshot('scratch/view1_overview_charts.png');

    // 2. Switch to View 5 (SITAC)
    await evaluate(`
      const sitacBtn = document.querySelector('[data-view="view-sitac-pa"]');
      if (sitacBtn) sitacBtn.click();
    `);
    await new Promise(r => setTimeout(r, 1500));
    await captureScreenshot('scratch/view5_sitac_charts.png');

    // 3. Switch to View 6 (Gangguan)
    await evaluate(`
      const gangguanBtn = document.querySelector('[data-view="view-gangguan"]');
      if (gangguanBtn) gangguanBtn.click();
    `);
    await new Promise(r => setTimeout(r, 1500));
    await captureScreenshot('scratch/view6_gangguan_charts.png');

    // 4. Switch to View 7 (Efisiensi)
    await evaluate(`
      const effBtn = document.querySelector('[data-view="view-efisiensi"]');
      if (effBtn) effBtn.click();
    `);
    await new Promise(r => setTimeout(r, 1500));
    await captureScreenshot('scratch/view7_efisiensi_charts.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
