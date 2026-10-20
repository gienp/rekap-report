import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-mobile-perfect-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9744;
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
      dontSetVisibleSize: false
    });

    console.log('Navigating to live Firebase URL...');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 3500));

    // Login as Field PIC (brian)
    await evaluate(`
      document.getElementById('loginUsername').value = 'brian';
      document.getElementById('loginPassword').value = 'pic123';
      document.getElementById('btnLoginSubmit').click();
    `);

    for (let i = 0; i < 30; i++) {
      const isLoginHidden = await evaluate(`document.getElementById('loginOverlay')?.style.display === 'none'`);
      if (isLoginHidden) break;
      await new Promise(r => setTimeout(r, 500));
    }
    await new Promise(r => setTimeout(r, 2000));

    // 1. Capture SITAC View on mobile (With Bottom Nav)
    const snap1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_sitac_after.png', Buffer.from(snap1.data, 'base64'));
    console.log('Saved scratch/mobile_sitac_after.png');

    // 2. Open bottom-sheet modal (Quick Edit)
    await evaluate(`
      const btn = document.querySelector('#sitacTableBody .btn-quick-edit');
      if (btn) btn.click();
    `);
    await new Promise(r => setTimeout(r, 1200));

    const snap2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_modal_after.png', Buffer.from(snap2.data, 'base64'));
    console.log('Saved scratch/mobile_modal_after.png');

    // Close the modal
    await evaluate(`
      const btnClose = document.getElementById('btnCloseQuickEdit') || document.getElementById('btnCancelQuickEdit');
      if (btnClose) btnClose.click();
    `);
    await new Promise(r => setTimeout(r, 600));

    // 3. Open Mobile Sidebar Drawer (via Menu button on bottom nav)
    await evaluate(`
      const btnMenu = document.getElementById('btnMobMenu');
      if (btnMenu) btnMenu.click();
    `);
    await new Promise(r => setTimeout(r, 1000));

    const snap3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_sidebar_after.png', Buffer.from(snap3.data, 'base64'));
    console.log('Saved scratch/mobile_sidebar_after.png');

    // Close sidebar by clicking backdrop
    await evaluate(`
      const backdrop = document.getElementById('sidebarBackdrop');
      if (backdrop) backdrop.click();
    `);
    await new Promise(r => setTimeout(r, 600));

    // 4. Switch to Gangguan view using Mobile Bottom Nav
    await evaluate(`
      const btnGangguan = document.getElementById('btnMobGangguan');
      if (btnGangguan) btnGangguan.click();
    `);
    await new Promise(r => setTimeout(r, 2000));

    const snap4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_gangguan_after.png', Buffer.from(snap4.data, 'base64'));
    console.log('Saved scratch/mobile_gangguan_after.png');

    // 5. Open "+ Tambah" Action Picker Sheet on Mobile
    await evaluate(`
      const btnAdd = document.getElementById('btnMobAddData');
      if (btnAdd) btnAdd.click();
    `);
    await new Promise(r => setTimeout(r, 1200));

    const snap5 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_picker_after.png', Buffer.from(snap5.data, 'base64'));
    console.log('Saved scratch/mobile_picker_after.png');

    console.log('ALL MOBILE SCREENSHOTS CAPTURED WITH EXACT VIEWPORT METRICS!');
  } catch (err) {
    console.error('Error during mobile verification:', err);
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main();
