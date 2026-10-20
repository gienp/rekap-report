import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-pic-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9832;
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
          const data = JSON.parse(e.data);
          if (data.id === id) {
            ws.removeEventListener('message', handler);
            if (data.error) reject(data.error);
            else resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Navigate to local server
    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 2500));

    // Log in as admin
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const u = document.getElementById('loginUsername');
          const p = document.getElementById('loginPassword');
          const b = document.getElementById('btnLoginSubmit');
          if (u && p && b) {
            u.value = 'admin';
            p.value = 'admin123';
            b.click();
          }
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Switch to View 8: Performa PIC SITAC
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const navBtn = document.querySelector('[data-view="view-pic-matrix"]');
          if (navBtn) navBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Inspect labels in charts and table
    const checkRes = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const workloadLabels = window.charts && window.charts.picWorkload ? window.charts.picWorkload.data.labels : [];
          const finishRateLabels = window.charts && window.charts.picFinishRate ? window.charts.picFinishRate.data.labels : [];
          const tableRows = Array.from(document.querySelectorAll('#picMatrixTableBody tr')).map(tr => {
            return tr.querySelector('td')?.textContent?.trim();
          });
          return { workloadLabels, finishRateLabels, tableRows };
        })()
      `
    });

    console.log('=== VERIFICATION RESULTS ===');
    console.log('Workload Chart Labels:', checkRes.result.value.workloadLabels);
    console.log('Finish Rate Chart Labels:', checkRes.result.value.finishRateLabels);
    console.log('Table Rows PIC Names:', checkRes.result.value.tableRows);

    // Capture View 8 screenshot
    const picScreenshot = await send('Page.captureScreenshot', { format: 'png' });
    const artifactDir = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';
    const picPath = path.join(artifactDir, 'pic_matrix_clean_names.png');
    fs.writeFileSync(picPath, Buffer.from(picScreenshot.data, 'base64'));
    console.log('Saved screenshot:', picPath);

    // Also navigate to View 5 (SITAC PA) and inspect filter dropdown
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const navBtn = document.querySelector('[data-view="view-sitac-pa"]');
          if (navBtn) navBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    const dropdownRes = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const select = document.getElementById('sitacFilterPic');
          if (!select) return [];
          return Array.from(select.options).map(o => o.text);
        })()
      `
    });
    console.log('SITAC Filter PIC Options:', dropdownRes.result.value);

    // Capture SITAC PA screenshot
    const sitacScreenshot = await send('Page.captureScreenshot', { format: 'png' });
    const sitacPath = path.join(artifactDir, 'sitac_pa_clean_names.png');
    fs.writeFileSync(sitacPath, Buffer.from(sitacScreenshot.data, 'base64'));
    console.log('Saved screenshot:', sitacPath);

    ws.close();
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    try {
      edgeProc.kill('SIGKILL');
    } catch (e) {}
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

main();
