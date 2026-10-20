import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-zoom-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9593;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1600,1000',
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

    // Login
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const userIn = document.getElementById('loginUsername');
          const passIn = document.getElementById('loginPassword');
          const submitBtn = document.getElementById('btnLoginSubmit');
          if (userIn && passIn && submitBtn) {
            userIn.value = 'admin';
            passIn.value = 'admin123';
            submitBtn.click();
          }
        })()
      `
    });

    await new Promise(r => setTimeout(r, 3000));

    // Go to view-webgis
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const closeDaily = document.getElementById('btnCloseDailyBanner');
          if (closeDaily) closeDaily.click();

          const btn = document.querySelector('button[data-view="view-webgis"]');
          if (btn) btn.click();
        })()
      `
    });

    await new Promise(r => setTimeout(r, 3000));

    // Zoom into Jabodetabek (center: -6.25, 106.85, zoom: 10)
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (window.leafletMap) {
            window.leafletMap.setView([-6.25, 106.85], 10);
            window.leafletMap.invalidateSize();
          }
          const mapEl = document.getElementById('portalLeafletMap');
          if (mapEl) mapEl.scrollIntoView({ behavior: 'instant', block: 'center' });
        })()
      `
    });

    await new Promise(r => setTimeout(r, 2500));

    const screenshot = await send('Page.captureScreenshot', { format: 'png', quality: 90 });
    const screenshotPath = path.resolve('scratch/live_webgis_jabodetabek_zoom.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`✓ Zoomed screenshot saved to: ${screenshotPath}`);

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
