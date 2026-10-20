import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-sitac-layout-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9620;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1600,1050',
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

    async function evaluate(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      return r.result?.value;
    }

    await send('Page.enable');
    await send('Page.navigate', { url: 'http://localhost:8888' });
    await new Promise(r => setTimeout(r, 3500));

    // Login as admin
    console.log('Logging in...');
    await evaluate(`
      document.getElementById('loginUsername').value = 'admin';
      document.getElementById('loginPassword').value = 'admin123';
      document.getElementById('btnLoginSubmit').click();
    `);

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      const hidden = await evaluate(`document.getElementById('loginOverlay')?.style.display === 'none'`);
      if (hidden) break;
    }
    await new Promise(r => setTimeout(r, 1500));

    // Dismiss banner
    await evaluate(`
      document.getElementById('btnCloseDailyBanner')?.click();
      const modal = document.getElementById('dailyBannerModal');
      if (modal) modal.style.display = 'none';
    `);

    // Navigate to view-sitac-pa
    console.log('Navigating to SITAC view...');
    await evaluate(`
      const btn = document.querySelector('[data-view="view-sitac-pa"]');
      if (btn) btn.click();
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Check widths of elements
    const dimensions = await evaluate(`
      (() => {
        const reg = document.getElementById('sitacRegionalFilterCard');
        const tb = document.querySelector('#view-sitac-pa .filter-toolbar-card');
        const table = document.getElementById('sitacTableCard');
        const container = document.getElementById('sitacChartsContainer');
        return {
          chartsContainerParent: container?.parentElement?.id,
          regWidth: reg?.offsetWidth,
          tbWidth: tb?.offsetWidth,
          tableWidth: table?.offsetWidth,
          isTableInsideCharts: container?.contains(table)
        };
      })()
    `);
    console.log('SITAC View Dimensions:', dimensions);

    // Scroll to see the filter card and table
    await evaluate(`
      document.getElementById('sitacRegionalFilterCard')?.scrollIntoView({ behavior: 'instant' });
    `);
    await new Promise(r => setTimeout(r, 1000));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.data, 'base64');
    fs.writeFileSync('scratch/sitac_layout_fixed.png', buffer);
    console.log('Saved screenshot to scratch/sitac_layout_fixed.png');

    await send('Browser.close');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    try { edgeProc.kill(); } catch (e) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main();
