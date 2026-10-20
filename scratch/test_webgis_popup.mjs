import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-popup-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9596;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1600,1050',
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
    await send('Page.navigate', { url: 'http://localhost:8888/index.html' });
    await new Promise(r => setTimeout(r, 3000));

    // Login & navigate
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('loginUsername').value = 'admin';
          document.getElementById('loginPassword').value = 'admin123';
          document.getElementById('btnLoginSubmit').click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('btnCloseDailyBanner')?.click();
          document.querySelector('button[data-view="view-webgis"]')?.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 3000));

    // Open first popup via layer
    const popupRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          // Open popup of first marker
          let found = false;
          let popupContent = '';
          if (window.leafletMap) {
            window.leafletMap.eachLayer(l => {
              if (l.getPopup && l.getPopup() && !found) {
                l.openPopup();
                found = true;
                popupContent = l.getPopup().getContent();
              }
            });
          }
          return { found, popupContent };
        })()
      `,
      returnByValue: true
    });

    console.log('Popup Open Result:', JSON.stringify(popupRes.result?.value, null, 2));

    await new Promise(r => setTimeout(r, 1000));
    const screenshot = await send('Page.captureScreenshot', { format: 'png', quality: 90 });
    const screenshotPath = path.resolve('scratch/test_webgis_popup_verified.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`Popup Screenshot saved: ${screenshotPath}`);

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
