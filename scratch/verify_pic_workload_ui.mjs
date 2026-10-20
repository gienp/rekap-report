import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';

async function verifyUrl(targetUrl, screenshotName) {
  console.log(`\n========================================`);
  console.log(`Verifying target: ${targetUrl}`);
  console.log(`========================================`);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-pic-'));
  const port = 9899;
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1600,1000',
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1600,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    });

    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        localStorage.setItem('telecom_portal_user', JSON.stringify({
          id: 1,
          username: 'admin',
          full_name: 'Administrator Proyek',
          role: 'admin',
          email: 'admin@telecom.ops'
        }));
        localStorage.setItem('telecom_portal_token', 'mock_token_admin');
      `
    });

    await send('Page.navigate', { url: targetUrl });
    await new Promise(r => setTimeout(r, 3500));

    // Ensure auth modal is hidden and switch to view-pic-matrix
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const authModal = document.getElementById('authModal');
          if (authModal) authModal.classList.add('hidden');
          const btn = document.querySelector('[data-view="view-pic-matrix"]');
          if (btn) btn.click();
        })()
      `
    });

    // Wait 2.5 seconds for data & charts
    await new Promise(r => setTimeout(r, 2500));

    // Verify DOM
    const verifyRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const tbody = document.getElementById('picMatrixTableBody');
          const rows = tbody ? Array.from(tbody.querySelectorAll('tr')).map(tr => {
            return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
          }) : [];

          const canvas1 = document.getElementById('chartPicWorkload');
          const canvas2 = document.getElementById('chartPicFinishRate');

          return {
            totalRows: rows.length,
            rows: rows,
            chart1Size: canvas1 ? { w: canvas1.width, h: canvas1.height } : null,
            chart2Size: canvas2 ? { w: canvas2.width, h: canvas2.height } : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log(`Total Rows rendered:`, verifyRes.result.value.totalRows);
    console.log(`Rows:`);
    verifyRes.result.value.rows.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r[0]} | Tasks: ${r[1]} | Finish: ${r[2]} | Rate: ${r[5]} | Efisiensi: ${r[8]} | SLA: ${r[9]}`);
    });

    // Capture screenshot
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const imgBuffer = Buffer.from(screenshot.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, screenshotName);
    fs.writeFileSync(outPath, imgBuffer);
    console.log(`Saved screenshot to: ${outPath}`);

    ws.close();
    return verifyRes.result.value.totalRows;
  } catch (err) {
    console.error('Error during verify:', err);
    return 0;
  } finally {
    edge.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

async function main() {
  const liveRows = await verifyUrl('https://analytics-811fc.web.app', 'pic_workload_restored_firebase.png');
  console.log(`Firebase live test completed with ${liveRows} rows.`);
}

main();
