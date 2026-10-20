import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-tip-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9855;
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
    await send('DOM.enable');
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

    // Force display the tooltip popup directly to check layout & clipping
    const tipState = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const icon = document.getElementById('iconColloInfo');
          const tipBox = icon ? icon.nextElementSibling : null;
          if (tipBox) {
            tipBox.classList.remove('hidden');
            tipBox.classList.add('block');
            tipBox.style.display = 'block';
            const rect = tipBox.getBoundingClientRect();
            return {
              text: tipBox.textContent.replace(/\\s+/g, ' ').trim(),
              rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
            };
          }
          return { error: 'tipBox not found' };
        })()
      `,
      returnByValue: true
    });
    console.log('TIP STATE:', tipState.result.value);

    // Capture screenshot around Card 1 & Card 2
    const snap = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 240, y: 150, width: 850, height: 420, scale: 1 }
    });
    const outPath = path.join(process.cwd(), 'scratch', 'tooltip_unclipped_verified.png');
    fs.writeFileSync(outPath, Buffer.from(snap.data, 'base64'));
    console.log('Screenshot saved to', outPath);

    // Copy to artifact
    const artifactDir = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';
    fs.copyFileSync(outPath, path.join(artifactDir, 'tooltip_unclipped_verified.png'));
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
