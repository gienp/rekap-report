import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-mobile-navcheck-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9755;
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
      deviceScaleFactor: 1,
      mobile: true,
      dontSetVisibleSize: false
    });

    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 3500));

    // Login as brian
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
    await new Promise(r => setTimeout(r, 2500));

    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 1,
      mobile: true,
      dontSetVisibleSize: false
    });

    const navData = await evaluate(`
      (() => {
        const nav = document.getElementById('mobileBottomNav');
        if (!nav) return { error: 'No #mobileBottomNav' };
        const cs = window.getComputedStyle(nav);
        const rect = nav.getBoundingClientRect();
        const pt = document.elementFromPoint(187, 780);
        return {
          rect: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height },
          display: cs.display,
          visibility: cs.visibility,
          opacity: cs.opacity,
          zIndex: cs.zIndex,
          position: cs.position,
          bottom: cs.bottom,
          elementFromPointAt780: pt ? { tag: pt.tagName, id: pt.id, class: pt.className } : null,
          bodyChildren: Array.from(document.body.children).map(c => ({ tag: c.tagName, id: c.id, z: window.getComputedStyle(c).zIndex }))
        };
      })()
    `);
    console.log('NAV DATA:', JSON.stringify(navData, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main();
