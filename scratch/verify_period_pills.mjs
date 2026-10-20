import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-pills-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9815;
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

    // Bypass login overlay to view dashboard
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (window.bypassLogin) window.bypassLogin();
          else {
            const overlay = document.getElementById('loginOverlay');
            if (overlay) overlay.style.display = 'none';
          }
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    // Evaluate pill labels
    const evalRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pills = Array.from(document.querySelectorAll('#execPeriodQuickPills button')).map(b => b.textContent.trim());
          const options = Array.from(document.querySelectorAll('#execFilterPeriod option')).map(o => o.textContent.trim());
          return { pills, options };
        })()
      `,
      returnByValue: true
    });
    console.log('EVAL LABELS:', JSON.stringify(evalRes.result.value, null, 2));

    // Capture screenshot of period filter area
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 500));

    const snap = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 260, y: 70, width: 980, height: 180, scale: 1 }
    });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'verify_period_pills.png'), Buffer.from(snap.data, 'base64'));
    console.log('Screenshot saved to scratch/verify_period_pills.png');

    ws.close();
  } finally {
    edgeProc.kill();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
