import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-mobile-topbar-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9811;
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

    // Login as Administrator (Admin role - matching user's exact screenshot!)
    await evaluate(`
      document.getElementById('loginUsername').value = 'admin';
      document.getElementById('loginPassword').value = 'admin123';
      document.getElementById('formLogin').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);

    for (let i = 0; i < 30; i++) {
      const isLoginHidden = await evaluate(`document.getElementById('loginOverlay')?.style.display === 'none'`);
      if (isLoginHidden) break;
      await new Promise(r => setTimeout(r, 500));
    }
    await new Promise(r => setTimeout(r, 2500));

    // Re-assert exact viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
      dontSetVisibleSize: false
    });

    // 1. Capture neat Mobile Topbar (Executive Dashboard as Admin)
    const snap1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_topbar_neat_admin.png', Buffer.from(snap1.data, 'base64'));
    console.log('Saved scratch/mobile_topbar_neat_admin.png');

    // 2. Open Mobile Sidebar to verify User Profile Card in drawer
    await evaluate(`
      const btnMenu = document.getElementById('sidebarToggleBtn');
      if (btnMenu) btnMenu.click();
    `);
    await new Promise(r => setTimeout(r, 1000));

    const snap2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_sidebar_with_profile.png', Buffer.from(snap2.data, 'base64'));
    console.log('Saved scratch/mobile_sidebar_with_profile.png');

    // Close sidebar
    await evaluate(`
      const backdrop = document.getElementById('sidebarBackdrop');
      if (backdrop) backdrop.click();
    `);
    await new Promise(r => setTimeout(r, 600));

    // 3. Open Alat & Ekspor menu on mobile
    await evaluate(`
      const btnTools = document.getElementById('btnToggleToolsMenu');
      if (btnTools) btnTools.click();
    `);
    await new Promise(r => setTimeout(r, 1000));

    const snap3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_tools_dropdown.png', Buffer.from(snap3.data, 'base64'));
    console.log('Saved scratch/mobile_tools_dropdown.png');

    // Close Alat & Ekspor menu
    await evaluate(`
      const btnTools = document.getElementById('btnToggleToolsMenu');
      if (btnTools) btnTools.click();
    `);
    await new Promise(r => setTimeout(r, 500));

    // 4. Open Notification Bell Panel on mobile
    await evaluate(`
      const btnBell = document.getElementById('btnContractAlertBell');
      if (btnBell) btnBell.click();
    `);
    await new Promise(r => setTimeout(r, 1000));

    const snap4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_bell_panel.png', Buffer.from(snap4.data, 'base64'));
    console.log('Saved scratch/mobile_bell_panel.png');

    console.log('ALL NEAT MOBILE SCREENSHOTS CAPTURED PERFECTLY!');
  } catch (err) {
    console.error('Error during mobile verification:', err);
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main();
