import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testUrl(targetUrl) {
  console.log(`\n========================================`);
  console.log(`Testing target: ${targetUrl}`);
  console.log(`========================================`);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-pic-'));
  const port = 9898;
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const list = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json());
    const page = list.find(t => t.type === 'page');
    if (!page) throw new Error('No page found');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
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

    await send('Page.navigate', { url: targetUrl });
    await new Promise(r => setTimeout(r, 4000));

    // Click on view-pic-matrix
    const clickRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('[data-view="view-pic-matrix"]');
          if (btn) {
            btn.click();
            return { clicked: true };
          }
          return { clicked: false, availableButtons: Array.from(document.querySelectorAll('[data-view]')).map(b => b.getAttribute('data-view')) };
        })()
      `,
      returnByValue: true
    });
    console.log('Click result:', clickRes.result.value);

    // Wait 3 seconds for data loading
    await new Promise(r => setTimeout(r, 3000));

    // Check table rows and state
    const checkRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const tbody = document.getElementById('picMatrixTableBody');
          const rows = tbody ? tbody.querySelectorAll('tr').length : 0;
          const trs = tbody ? Array.from(tbody.querySelectorAll('tr')).map(tr => {
            const tds = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
            return tds;
          }) : [];
          const canvas1 = document.getElementById('chartPicWorkload');
          const canvas2 = document.getElementById('chartPicFinishRate');
          return {
            rowCount: rows,
            rows: trs.slice(0, 5),
            chart1Exists: !!canvas1,
            chart2Exists: !!canvas2,
            chart1HasData: !!(canvas1 && window.charts && window.charts.picWorkload),
            chart2HasData: !!(canvas2 && window.charts && window.charts.picFinishRate)
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Check result:', JSON.stringify(checkRes.result.value, null, 2));

    ws.close();
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    edge.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

async function run() {
  await testUrl('http://localhost:8888');
  await testUrl('https://analytics-811fc.web.app');
}

run();
