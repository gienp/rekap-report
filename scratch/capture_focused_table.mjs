import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-scroll-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9630;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1800,1100',
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

    async function captureScreenshot(name) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(ARTIFACT_DIR, `${name}.png`);
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
      console.log(`Saved screenshot: ${filePath}`);
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1750,
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false
    });

    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        localStorage.setItem('telecom_portal_user', JSON.stringify({
          username: 'admin',
          full_name: 'Administrator',
          role: 'admin'
        }));
        localStorage.setItem('telecom_portal_token', 'mock_admin_token');
      `
    });

    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 3000));

    // Dismiss notifications & nav
    await evaluate(`
      (() => {
        const dismissBtn = document.querySelector('#modalDailyContractNotification .btn-secondary') ||
                           document.querySelector('#modalDailyContractNotification button:last-child');
        if (dismissBtn) dismissBtn.click();
        const authOverlay = document.getElementById('authOverlay');
        if (authOverlay) authOverlay.classList.add('hidden');
        const loginOverlay = document.getElementById('loginOverlay');
        if (loginOverlay) loginOverlay.style.display = 'none';

        const navBtn = document.querySelector('[data-view="view-collo-list"]');
        if (navBtn) navBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Expand financial summary panel
    await evaluate(`
      (() => {
        const card = document.getElementById('colloFinSummaryCard');
        if (card && card.classList.contains('hidden')) {
          document.getElementById('btnToggleColloFinSummary')?.click();
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 500));

    // Scroll table container slightly to show financial columns in center
    await evaluate(`
      (() => {
        const tableContainer = document.querySelector('#view-collo-list .overflow-x-auto');
        if (tableContainer) {
          tableContainer.scrollLeft = 450;
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 500));

    await captureScreenshot('collo_table_biaya_deposito_focused');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
