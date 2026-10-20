import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-carry-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9840;
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
    await new Promise(r => setTimeout(r, 3500));

    // 1. Check ALL PERIOD STATE
    const allState = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const activeVal = document.getElementById('execActiveCollo')?.textContent.trim();
          const label = document.getElementById('execActiveColloLabel')?.textContent.trim();
          const masterText = document.getElementById('execColloUniqueMasterWrap')?.textContent.trim();
          const masterHidden = document.getElementById('execColloUniqueMasterWrap')?.classList.contains('hidden');
          const newHidden = document.getElementById('execColloNewWrap')?.classList.contains('hidden');
          return { activeVal, label, masterText, masterHidden, newHidden };
        })()
      `,
      returnByValue: true
    });
    console.log('ALL PERIOD STATE:', allState.result.value);

    // Capture screenshot of ALL
    const snapAll = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 240, y: 70, width: 1100, height: 520, scale: 1 }
    });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'card1_all_period.png'), Buffer.from(snapAll.data, 'base64'));

    // 2. Click 2026 PILL
    await send('Runtime.evaluate', {
      expression: `document.querySelector('#execPeriodQuickPills button[data-period="2026"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 2000));

    const y2026State = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const activeVal = document.getElementById('execActiveCollo')?.textContent.trim();
          const label = document.getElementById('execActiveColloLabel')?.textContent.trim();
          const newCount = document.getElementById('execColloNewCount')?.textContent.trim();
          const carryCount = document.getElementById('execColloCarryCount')?.textContent.trim();
          const masterHidden = document.getElementById('execColloUniqueMasterWrap')?.classList.contains('hidden');
          const newHidden = document.getElementById('execColloNewWrap')?.classList.contains('hidden');
          return { activeVal, label, newCount, carryCount, masterHidden, newHidden };
        })()
      `,
      returnByValue: true
    });
    console.log('2026 PERIOD STATE:', y2026State.result.value);

    // Capture screenshot of 2026
    const snap2026 = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 240, y: 70, width: 1100, height: 520, scale: 1 }
    });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'card1_2026_period.png'), Buffer.from(snap2026.data, 'base64'));

    // 3. Copy artifacts
    const artifactDir = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';
    fs.copyFileSync(
      path.join(process.cwd(), 'scratch', 'card1_all_period.png'),
      path.join(artifactDir, 'card1_all_period_master.png')
    );
    fs.copyFileSync(
      path.join(process.cwd(), 'scratch', 'card1_2026_period.png'),
      path.join(artifactDir, 'card1_2026_breakdown.png')
    );
    console.log('Artifacts copied successfully!');

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
