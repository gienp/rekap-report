import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-light-pills-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9819;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--force-device-scale-factor=1',
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
          const data = JSON.parse(e.data);
          if (data.id === id) {
            ws.removeEventListener('message', handler);
            if (data.error) reject(data.error);
            else resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    const filePath = path.join(process.cwd(), 'index.html').replace(/\\/g, '/');
    await send('Page.navigate', { url: `file:///${filePath}` });
    await new Promise(r => setTimeout(r, 2500));

    // Bypass login overlay and set light mode
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (window.bypassLogin) window.bypassLogin();
          const overlay = document.getElementById('loginOverlay');
          if (overlay) overlay.style.display = 'none';
          document.documentElement.setAttribute('data-theme', 'light');
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false
    });
    const snapLight = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 260, y: 70, width: 980, height: 180, scale: 1 }
    });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'verify_period_pills_light.png'), Buffer.from(snapLight.data, 'base64'));
    console.log('Saved clean screenshot to scratch/verify_period_pills_light.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
