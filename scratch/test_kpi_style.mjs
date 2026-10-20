import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function testStyle(fontSize, whiteSpace) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-kpi-test-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9645;
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

    // Apply custom style to .kpi-value
    const applied = await evaluate(`
      (() => {
        const style = document.createElement('style');
        style.id = 'test-kpi-fix';
        style.innerHTML = \`
          .kpi-value {
            font-size: ${fontSize} !important;
            white-space: ${whiteSpace} !important;
            letter-spacing: -0.02em !important;
            line-height: 1.2 !important;
          }
        \`;
        document.head.appendChild(style);

        const el2 = document.getElementById('revShareTotalRev');
        const el3 = document.getElementById('revShareTotalFee');
        return {
          rev: { text: el2?.innerText, rect: el2?.getBoundingClientRect() },
          fee: { text: el3?.innerText, rect: el3?.getBoundingClientRect() }
        };
      })()
    `);
    console.log('Applied results:', JSON.stringify(applied, null, 2));

    // Scroll to KPI cards
    await evaluate(`
      document.getElementById('revShareTotalFee')?.closest('.kpi-card')?.scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise(r => setTimeout(r, 500));

    // Capture screenshot
    const snap = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(snap.data, 'base64');
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'kpi_cards_fixed.png'), buffer);
    console.log('Saved scratch/kpi_cards_fixed.png');

  } finally {
    try { edgeProc.kill(); } catch (e) {}
  }
}

testStyle('clamp(1.15rem, 1.4vw, 1.5rem)', 'nowrap').catch(console.error);
