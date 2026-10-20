import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-deposito-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9625;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1600,1100',
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
      width: 1560,
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Pre-populate admin user in localStorage before portal scripts run
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

    console.log('Navigating to http://localhost:8888...');
    await send('Page.navigate', { url: 'http://localhost:8888' });

    // Wait until loaded
    for (let i = 0; i < 40; i++) {
      const ready = await evaluate(`
        document.readyState === 'complete' && 
        document.getElementById('userNameDisplay')?.textContent.includes('Administrator')
      `);
      if (ready) break;
      await new Promise(r => setTimeout(r, 250));
    }
    await new Promise(r => setTimeout(r, 2000));

    // Dismiss any notification modals or overlays
    await evaluate(`
      (() => {
        const dismissBtn = document.querySelector('#modalDailyContractNotification .btn-secondary') ||
                           document.querySelector('#modalDailyContractNotification button:last-child');
        if (dismissBtn) dismissBtn.click();
        const authOverlay = document.getElementById('authOverlay');
        if (authOverlay) authOverlay.classList.add('hidden');
        const loginOverlay = document.getElementById('loginOverlay');
        if (loginOverlay) loginOverlay.style.display = 'none';
      })()
    `);

    // Navigate to view-collo-list
    console.log('Navigating to view-collo-list...');
    await evaluate(`
      (() => {
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
    await new Promise(r => setTimeout(r, 800));

    // Capture main collo table screenshot
    await captureScreenshot('collo_table_with_biaya_deposito');

    // Test Quick Edit Modal
    console.log('Opening Quick Edit Modal...');
    await evaluate(`
      (() => {
        const btnEdit = document.querySelector('#colloTableBody .btn-quick-edit');
        if (btnEdit) btnEdit.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1200));

    // Enter test value in quick edit deposit input to verify live reactive preview
    await evaluate(`
      (() => {
        const inputDeposit = document.getElementById('quickEditBiayaDeposit');
        if (inputDeposit) {
          inputDeposit.value = '15000000';
          inputDeposit.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 600));

    await captureScreenshot('collo_quick_edit_biaya_deposito');

    // Close quick edit modal
    await evaluate(`document.getElementById('btnCloseQuickEdit')?.click()`);
    await new Promise(r => setTimeout(r, 600));

    // Test Detail Modal
    console.log('Opening Detail Modal...');
    await evaluate(`
      (() => {
        const btnDetail = document.querySelector('#colloTableBody .btn-view-detail');
        if (btnDetail) btnDetail.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1200));

    await captureScreenshot('collo_detail_modal_biaya_deposito');

    // Close detail modal
    await evaluate(`document.getElementById('btnCloseDetail')?.click()`);

    console.log('All Biaya Deposito screenshots captured cleanly!');
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
