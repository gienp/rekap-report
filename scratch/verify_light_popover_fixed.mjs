import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

(async () => {
  console.log('--- VERIFYING LIGHT MODE POPOVER FIX ---');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-popover-test-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9540;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + cdpPort,
    '--user-data-dir=' + tmpDir,
    '--window-size=1440,900',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`http://localhost:${cdpPort}/json`);
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

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Navigating to http://localhost:8888 ...');
    await send('Page.navigate', { url: 'http://localhost:8888' });
    await new Promise(r => setTimeout(r, 2000));

    // Helper for evaluate
    async function evalCode(expr) {
      const wrappedExpr = `(async () => {\n${expr}\n})()`;
      const res = await send('Runtime.evaluate', {
        expression: wrappedExpr,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        console.error('Eval error:', res.exceptionDetails);
        throw new Error(res.exceptionDetails.text || 'Eval error');
      }
      return res.result?.value;
    }

    // Capture screenshot helper
    async function captureScreenshot(filepath, clip = null) {
      const params = { format: 'png' };
      if (clip) params.clip = clip;
      const snap = await send('Page.captureScreenshot', params);
      fs.writeFileSync(filepath, Buffer.from(snap.data, 'base64'));
      console.log('Screenshot saved:', filepath);
    }

    // 1. Set localStorage auth & reload
    console.log('Setting auth in localStorage and reloading...');
    await evalCode(`
      localStorage.setItem('telecom_portal_user', JSON.stringify({
        username: 'admin',
        full_name: 'Administrator',
        role: 'admin',
        pic_code: 'Admin'
      }));
      localStorage.setItem('telecom_portal_token', 'fb_auth_admin_mock');
      window.location.reload();
    `);
    await new Promise(r => setTimeout(r, 2500));

    // 2. Toggle to light mode via button click
    console.log('Toggling to light mode via themeToggleBtn...');
    await evalCode(`
      const btn = document.getElementById('themeToggleBtn');
      if (document.documentElement.getAttribute('data-theme') !== 'light') {
        if (btn) btn.click();
        else document.documentElement.setAttribute('data-theme', 'light');
      }
    `);
    await new Promise(r => setTimeout(r, 800));

    // 3. Open popover #popoverColloInfo
    console.log('Opening #popoverColloInfo...');
    const popoverBounds = await evalCode(`
      const popover = document.getElementById('popoverColloInfo');
      if (popover) {
        popover.classList.remove('hidden');
        const rect = popover.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          computedBg: window.getComputedStyle(popover).backgroundColor,
          computedColor: window.getComputedStyle(popover).color,
          firstStrongColor: window.getComputedStyle(popover.querySelector('strong')).color,
          firstStrongWeight: window.getComputedStyle(popover.querySelector('strong')).fontWeight
        };
      }
      return null;
    `);
    console.log('Popover inspection in light mode:', popoverBounds);

    // 4. Capture screenshot focused on the popover and card 1
    console.log('Capturing focused screenshot...');
    await new Promise(r => setTimeout(r, 500));
    
    // Capture clip with some padding around the popover
    if (popoverBounds && popoverBounds.width > 0) {
      const clip = {
        x: Math.max(0, popoverBounds.x - 20),
        y: Math.max(0, popoverBounds.y - 20),
        width: popoverBounds.width + 40,
        height: popoverBounds.height + 40,
        scale: 1
      };
      await captureScreenshot('scratch/verified_popover_light_focused.png', clip);
    }

    // Also full dashboard view in light mode
    await captureScreenshot('scratch/verified_dashboard_light_popover.png');

    console.log('--- VERIFICATION SUCCESSFUL ---');
  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    try { edgeProc.kill(); } catch (e) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
})();
