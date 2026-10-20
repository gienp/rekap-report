import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-scroll-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9897;
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

    let id = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const msgId = id++;
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === msgId) {
          ws.removeEventListener('message', handler);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: 'http://localhost:8888' });
    await new Promise(r => setTimeout(r, 3000));

    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const navBtn = document.querySelector('.nav-item[data-view="view-sitac-pa"]');
          if (navBtn) navBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    const getArrowTop = async () => {
      const { result } = await send('Runtime.evaluate', {
        expression: 'document.getElementById("sitacScrollArrowRight").style.top',
        returnByValue: true
      });
      return result.value;
    };

    const topBefore = await getArrowTop();
    console.log('Arrow style.top BEFORE page scroll:', topBefore);

    await send('Runtime.evaluate', {
      expression: 'window.scrollTo(0, 350); window.dispatchEvent(new Event("scroll"));'
    });
    await new Promise(r => setTimeout(r, 500));

    const topAfter = await getArrowTop();
    console.log('Arrow style.top AFTER page scroll 350px:', topAfter);

    console.log('Stable position verified:', topBefore === topAfter && topBefore !== '');
    ws.close();
  } finally {
    edgeProc.kill('SIGKILL');
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
