import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-pop-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9866;
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
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        localStorage.setItem('telecom_portal_user', JSON.stringify({
          id: 1,
          username: 'admin',
          full_name: 'Administrator (Manajemen)',
          role: 'admin',
          email: 'admin@telecom.co.id'
        }));
        localStorage.setItem('portal_theme', 'dark');
      `
    });

    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 3000));

    // Click #btnColloInfoTip to open popover
    const clickRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.getElementById('btnColloInfoTip');
          if (btn) btn.click();
          const pop = document.getElementById('popoverColloInfo');
          const isVisible = pop && !pop.classList.contains('hidden');
          const rect = pop ? pop.getBoundingClientRect() : null;
          const card1Rect = document.querySelector('.bento-kpi-card')?.getBoundingClientRect();
          const card2Rect = document.querySelectorAll('.bento-kpi-card')[1]?.getBoundingClientRect();
          return {
            isVisible,
            popRect: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null,
            card1Rect: card1Rect ? { x: card1Rect.x, w: card1Rect.width, right: card1Rect.right } : null,
            card2Rect: card2Rect ? { x: card2Rect.x, w: card2Rect.width } : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('CLICK & POPOVER CHECK:', JSON.stringify(clickRes.result.value, null, 2));

    await new Promise(r => setTimeout(r, 500));

    // Capture screenshot of Card 1 and Card 2
    const snap = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 240, y: 150, width: 850, height: 420, scale: 1 }
    });
    const outPath = path.join(process.cwd(), 'scratch', 'popover_perfect_verified.png');
    fs.writeFileSync(outPath, Buffer.from(snap.data, 'base64'));
    console.log('Screenshot saved to', outPath);

    // Copy to artifact
    const artifactDir = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';
    fs.copyFileSync(outPath, path.join(artifactDir, 'popover_perfect_verified.png'));
    console.log('Artifact copied successfully!');

    ws.close();
  } finally {
    try { edgeProc.kill(); } catch (e) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
