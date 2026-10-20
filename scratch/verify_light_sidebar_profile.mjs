import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-light-profile-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9816;
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

    // Bypass login overlay and switch to light mode
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (window.bypassLogin) window.bypassLogin();
          else {
            const overlay = document.getElementById('loginOverlay');
            if (overlay) overlay.style.display = 'none';
          }
          // Set light mode
          document.documentElement.setAttribute('data-theme', 'light');
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    // Capture screenshot of sidebar user profile
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 500));

    // Capture sidebar profile card
    const snap = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: 280, height: 200, scale: 1 }
    });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'verify_light_sidebar_profile.png'), Buffer.from(snap.data, 'base64'));
    console.log('Sidebar profile screenshot saved to scratch/verify_light_sidebar_profile.png');

    // Also capture topbar user profile in light mode
    const snapTopbar = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 950, y: 0, width: 330, height: 75, scale: 1 }
    });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'verify_light_topbar_profile.png'), Buffer.from(snapTopbar.data, 'base64'));
    console.log('Topbar profile screenshot saved to scratch/verify_light_topbar_profile.png');

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
