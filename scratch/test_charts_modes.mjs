import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-charts-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9830;
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1400,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    const filePath = path.join(process.cwd(), 'index.html').replace(/\\/g, '/');
    await send('Page.navigate', { url: `file:///${filePath}` });
    await new Promise(r => setTimeout(r, 2000));

    // Log in as admin
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('loginUsername').value = 'admin';
          document.getElementById('loginPassword').value = 'admin123';
          document.getElementById('btnLoginSubmit').click();
          const alertBanner = document.getElementById('dailyContractAlertBanner');
          if (alertBanner) alertBanner.style.display = 'none';
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Scroll down to charts
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          window.scrollTo(0, 450);
          document.documentElement.removeAttribute('data-theme');
        })()
      `
    });
    await new Promise(r => setTimeout(r, 500));
    const snapDark = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'charts_compare_dark.png'), Buffer.from(snapDark.data, 'base64'));

    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.documentElement.setAttribute('data-theme', 'light');
        })()
      `
    });
    await new Promise(r => setTimeout(r, 500));
    const snapLight = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'charts_compare_light.png'), Buffer.from(snapLight.data, 'base64'));

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
