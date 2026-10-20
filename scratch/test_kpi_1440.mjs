import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-kpi-4col-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9650;
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
    
    // Explicit 1440x900 desktop viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 3000));

    // Login as admin
    await evaluate(`
      document.getElementById('loginUsername').value = 'admin';
      document.getElementById('loginPassword').value = 'admin123';
      document.getElementById('btnLoginSubmit').click();
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Dismiss banner & modal
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

    // Check computed styles and text
    const checkResult = await evaluate(`
      (() => {
        const fee = document.getElementById('revShareTotalFee');
        const rev = document.getElementById('revShareTotalRev');
        const csFee = window.getComputedStyle(fee);
        const rectFee = fee.getBoundingClientRect();
        const cardRect = fee.closest('.kpi-card').getBoundingClientRect();
        return {
          feeText: fee.innerText,
          revText: rev.innerText,
          whiteSpace: csFee.whiteSpace,
          fontSize: csFee.fontSize,
          lineHeight: csFee.lineHeight,
          feeWidth: rectFee.width,
          feeHeight: rectFee.height,
          cardWidth: cardRect.width,
          isSingleLine: rectFee.height <= parseFloat(csFee.lineHeight) * 1.5
        };
      })()
    `);
    console.log('1440px desktop verification result:', JSON.stringify(checkResult, null, 2));

    // Scroll to KPI cards with top alignment
    await evaluate(`
      document.getElementById('revShareTotalFee')?.closest('.kpi-card')?.scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise(r => setTimeout(r, 500));

    // Desktop screenshot
    const snapDesk = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'kpi_cards_final_1440desktop.png'), Buffer.from(snapDesk.data, 'base64'));
    console.log('Saved scratch/kpi_cards_final_1440desktop.png');

  } finally {
    try { edgeProc.kill(); } catch (e) {}
  }
}

main().catch(console.error);
