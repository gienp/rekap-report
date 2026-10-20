import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-pic-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9558;

  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1600,1000',
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
    await new Promise(r => setTimeout(r, 2500));

    // Switch to view-pic-matrix directly via app
    await evaluate(`
      const btn = document.querySelector('[data-view="view-pic-matrix"]');
      if (btn) btn.click();
    `);
    await new Promise(r => setTimeout(r, 1500));
    await captureScreenshot('scratch/view8_pic_captured.png');

    // Switch to view-alerts
    await evaluate(`
      const btn = document.querySelector('[data-view="view-alerts"]');
      if (btn) btn.click();
    `);
    await new Promise(r => setTimeout(r, 1500));
    await captureScreenshot('scratch/view4_alerts_captured.png');

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
