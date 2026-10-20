import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-mobile-wide-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9777;
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
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 3000));

    // Login as brian
    await evaluate(`
      document.getElementById('loginUsername').value = 'brian';
      document.getElementById('loginPassword').value = 'pic123';
      document.getElementById('formLogin').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);

    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 300));
      const hidden = await evaluate(`document.getElementById('loginOverlay')?.style.display === 'none'`);
      if (hidden) break;
    }
    await new Promise(r => setTimeout(r, 1500));

    const wideElements = await evaluate(`
      (() => {
        const all = document.querySelectorAll('*');
        const results = [];
        all.forEach(el => {
          if (el.scrollWidth > 380 && !['HTML', 'BODY', 'MAIN'].includes(el.tagName)) {
            results.push({
              tag: el.tagName,
              id: el.id,
              class: el.className.toString().slice(0, 50),
              scrollWidth: el.scrollWidth,
              offsetWidth: el.offsetWidth,
              clientWidth: el.clientWidth
            });
          }
        });
        return results.slice(0, 15);
      })()
    `);
    console.log('WIDE ELEMENTS:', wideElements);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main();
