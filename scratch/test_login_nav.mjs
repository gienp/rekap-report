import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-mobile-ln-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9766;
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
    await new Promise(r => setTimeout(r, 3000));

    // Listen to console and page events
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.method === 'Page.frameNavigated') {
        console.log('PAGE NAVIGATED TO:', msg.params?.frame?.url);
      }
    });

    // Check size before login
    console.log('1. BEFORE:', await evaluate(`({ w: window.innerWidth, h: window.innerHeight })`));

    // Fill form and submit
    await evaluate(`
      document.getElementById('loginUsername').value = 'brian';
      document.getElementById('loginPassword').value = 'pic123';
      document.getElementById('formLogin').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);

    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 300));
      const s = await evaluate(`({
        w: window.innerWidth,
        h: window.innerHeight,
        hidden: document.getElementById('loginOverlay')?.style.display === 'none'
      })`);
      console.log(`Step ${i}:`, s);
      if (s.hidden) break;
    }

    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 1,
      mobile: true,
      fitWindow: false
    });

    const finalSize = await evaluate(`
      ({
        w: window.innerWidth,
        h: window.innerHeight,
        nav: (() => {
          const n = document.getElementById('mobileBottomNav');
          const r = n ? n.getBoundingClientRect() : null;
          return r ? { top: r.top, bottom: r.bottom, height: r.height } : null;
        })()
      })
    `);
    console.log('FINAL SIZE AFTER RE-OVERRIDE:', finalSize);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main();
