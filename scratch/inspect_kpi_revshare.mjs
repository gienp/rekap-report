import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-kpi-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9644;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1366,768',
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

    // Navigate to rev sharing
    await evaluate(`
      const btn = document.querySelector('[data-view="view-collo-rev-sharing"]');
      if (btn) btn.click();
    `);
    await new Promise(r => setTimeout(r, 2500));

    // Inspect revShareTotalFee text and computed style
    const info = await evaluate(`
      (() => {
        const el = document.getElementById('revShareTotalFee');
        if (!el) return { error: 'Not found' };
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          text: el.innerText,
          fontSize: cs.fontSize,
          lineHeight: cs.lineHeight,
          whiteSpace: cs.whiteSpace,
          width: rect.width,
          height: rect.height,
          cardWidth: el.closest('.kpi-card')?.getBoundingClientRect()?.width
        };
      })()
    `);
    console.log('revShareTotalFee info:', info);

    // Scroll to KPI cards
    await evaluate(`
      document.getElementById('revShareTotalFee')?.closest('.kpi-card')?.scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise(r => setTimeout(r, 500));

    // Capture screenshot of KPI cards
    const snap = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(snap.data, 'base64');
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'kpi_cards_before.png'), buffer);
    console.log('Saved scratch/kpi_cards_before.png');

  } finally {
    try { edgeProc.kill(); } catch (e) {}
  }
}

main().catch(console.error);
