import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function testWidths() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-kpi-widths-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9647;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1200,800',
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

    async function evaluate(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      return r.result?.value;
    }

    await send('Page.enable');
    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 3000));

    // Login as admin
    await evaluate(`
      document.getElementById('loginUsername').value = 'admin';
      document.getElementById('loginPassword').value = 'admin123';
      document.getElementById('btnLoginSubmit').click();
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Close banner & modal
    await evaluate(`
      const b = document.getElementById('dailyContractAlertBanner');
      if (b) b.remove();
      const m = document.getElementById('dailyBannerModal');
      if (m) m.remove();
    `);

    // Navigate to rev sharing
    await evaluate(`
      const btn = document.querySelector('[data-view="view-collo-rev-sharing"]');
      if (btn) btn.click();
    `);
    await new Promise(r => setTimeout(r, 2500));

    // Inject styles & set long text like in screenshot
    await evaluate(`
      const style = document.createElement('style');
      style.innerHTML = \`
        .kpi-value {
          font-size: clamp(1.15rem, 1.35vw, 1.55rem) !important;
          white-space: nowrap !important;
          letter-spacing: -0.02em !important;
          line-height: 1.2 !important;
        }
      \`;
      document.head.appendChild(style);

      // Force the exact number from user screenshot:
      document.getElementById('revShareTotalFee').textContent = 'Rp 10.625.850.998';
      document.getElementById('revShareTotalRev').textContent = 'Rp 51.691.800.000';
    `);
    await new Promise(r => setTimeout(r, 500));

    // Scroll to KPI cards
    await evaluate(`
      document.getElementById('revShareTotalFee')?.closest('.kpi-card')?.scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise(r => setTimeout(r, 500));

    // 1200px snap
    const snap1200 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'kpi_cards_1200.png'), Buffer.from(snap1200.data, 'base64'));
    console.log('Saved scratch/kpi_cards_1200.png');

    // 1024px snap
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1024,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 800));

    const snap1024 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'kpi_cards_1024.png'), Buffer.from(snap1024.data, 'base64'));
    console.log('Saved scratch/kpi_cards_1024.png');

  } finally {
    try { edgeProc.kill(); } catch (e) {}
  }
}

testWidths().catch(console.error);
