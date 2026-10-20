import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-dual-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9897;
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

    let id = 1;
    const send = (method, params = {}) => new Promise((resolve) => {
      const msgId = id++;
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

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
      `
    });

    console.log('Navigating to http://localhost:8888 ...');
    await send('Page.navigate', { url: 'http://localhost:8888' });
    await new Promise(r => setTimeout(r, 3000));

    const artifactDir = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';

    const getClip = async (selector) => {
      const { result } = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const el = document.querySelector('${selector}');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          })()
        `,
        returnByValue: true
      });
      return result.value;
    };

    // 1. Capture Card 1 in "Semua Periode" mode
    let clip = await getClip('.bento-kpi-card.bento-cyan');
    if (clip) {
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { ...clip, scale: 1 }
      });
      fs.writeFileSync(path.join(artifactDir, 'card1_dual_metric_all_periods.png'), Buffer.from(data, 'base64'));
      console.log('Saved card1_dual_metric_all_periods.png');
    }

    // Capture bento grid
    let gridClip = await getClip('.bento-kpi-grid');
    if (gridClip) {
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { ...gridClip, scale: 1 }
      });
      fs.writeFileSync(path.join(artifactDir, 'bento_grid_dual_metric_verified.png'), Buffer.from(data, 'base64'));
      console.log('Saved bento_grid_dual_metric_verified.png');
    }

    // 2. Click 2026 filter
    console.log('Filtering year 2026 ...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('.exec-period-pill[data-period="2026"]');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    clip = await getClip('.bento-kpi-card.bento-cyan');
    if (clip) {
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { ...clip, scale: 1 }
      });
      fs.writeFileSync(path.join(artifactDir, 'card1_dual_metric_2026.png'), Buffer.from(data, 'base64'));
      console.log('Saved card1_dual_metric_2026.png');
    }

    // 3. Switch back to Semua Periode and click popover
    console.log('Switching back and opening popover ...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = Array.from(document.querySelectorAll('.filter-pill-btn')).find(b => b.textContent.trim() === 'Semua Periode');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    await send('Runtime.evaluate', {
      expression: `document.getElementById('btnColloInfoTip')?.click()`
    });
    await new Promise(r => setTimeout(r, 500));

    clip = await getClip('.bento-kpi-card.bento-cyan');
    if (clip) {
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { ...clip, scale: 1 }
      });
      fs.writeFileSync(path.join(artifactDir, 'card1_popover_dual_metric.png'), Buffer.from(data, 'base64'));
      console.log('Saved card1_popover_dual_metric.png');
    }

    ws.close();
  } finally {
    edgeProc.kill('SIGKILL');
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    console.log('Verification done!');
  }
}

main().catch(console.error);
