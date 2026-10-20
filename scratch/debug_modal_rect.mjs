import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-mobile-rect-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9711;
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
      fitWindow: false
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
    await new Promise(r => setTimeout(r, 2000));

    // Check nav rect
    const navRect = await evaluate(`
      (() => {
        const nav = document.getElementById('mobileBottomNav');
        const r = nav ? nav.getBoundingClientRect() : null;
        return {
          windowInnerHeight: window.innerHeight,
          documentClientHeight: document.documentElement.clientHeight,
          nav: r ? { top: r.top, bottom: r.bottom, left: r.left, width: r.width, height: r.height } : null
        };
      })()
    `);
    console.log('NAV RECT:', navRect);

    // Open Quick Edit
    await evaluate(`
      const btn = document.querySelector('#sitacTableBody .btn-quick-edit');
      if (btn) btn.click();
    `);
    await new Promise(r => setTimeout(r, 1000));

    const modalRect = await evaluate(`
      (() => {
        const modal = document.getElementById('modalQuickEdit');
        const card = modal ? modal.querySelector('.portal-modal-card') : null;
        const mr = modal ? modal.getBoundingClientRect() : null;
        const cr = card ? card.getBoundingClientRect() : null;
        return {
          modal: mr ? { top: mr.top, bottom: mr.bottom, height: mr.height } : null,
          card: cr ? { top: cr.top, bottom: cr.bottom, height: cr.height } : null,
          cardComputedStyle: card ? {
            maxHeight: window.getComputedStyle(card).maxHeight,
            height: window.getComputedStyle(card).height,
            transform: window.getComputedStyle(card).transform,
            display: window.getComputedStyle(card).display
          } : null
        };
      })()
    `);
    console.log('MODAL RECT:', modalRect);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main();
