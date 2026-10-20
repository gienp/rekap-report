import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-period-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9817;
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
    const filePath = path.join(process.cwd(), 'index.html').replace(/\\/g, '/');
    await send('Page.navigate', { url: `file:///${filePath}` });
    await new Promise(r => setTimeout(r, 2500));

    // Bypass login overlay
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (window.bypassLogin) window.bypassLogin();
          else {
            const overlay = document.getElementById('loginOverlay');
            if (overlay) overlay.style.display = 'none';
          }
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    // 1. Inspect period pills & options
    const filterInfo = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pills = Array.from(document.querySelectorAll('#execPeriodQuickPills .exec-period-pill')).map(p => ({
            text: p.textContent.trim(),
            period: p.getAttribute('data-period')
          }));
          const options = Array.from(document.querySelectorAll('#execFilterPeriod option')).map(o => ({
            text: o.textContent.trim(),
            value: o.value
          }));
          return { pills, options };
        })()
      `,
      returnByValue: true
    });
    console.log('Filter Pills:', filterInfo.result.value.pills);
    console.log('Filter Select Options:', filterInfo.result.value.options);

    // 2. Test switching to 2024
    const res2024 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pill2024 = document.querySelector('#execPeriodQuickPills .exec-period-pill[data-period="2024"]');
          if (pill2024) pill2024.click();
          return {
            sitac: document.getElementById('execSitacFinish')?.textContent.trim(),
            collo: document.getElementById('execActiveCollo')?.textContent.trim(),
            gangguan: document.getElementById('execGangguanTotal')?.textContent.trim()
          };
        })()
      `,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 1000));
    console.log('Metrics after clicking 2024:', res2024.result.value);

    // 3. Test switching to 2025
    const res2025 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pill2025 = document.querySelector('#execPeriodQuickPills .exec-period-pill[data-period="2025"]');
          if (pill2025) pill2025.click();
          return {
            sitac: document.getElementById('execSitacFinish')?.textContent.trim(),
            collo: document.getElementById('execActiveCollo')?.textContent.trim(),
            gangguan: document.getElementById('execGangguanTotal')?.textContent.trim()
          };
        })()
      `,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 1000));
    console.log('Metrics after clicking 2025:', res2025.result.value);

    // 4. Test switching to 2026
    const res2026 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pill2026 = document.querySelector('#execPeriodQuickPills .exec-period-pill[data-period="2026"]');
          if (pill2026) pill2026.click();
          return {
            sitac: document.getElementById('execSitacFinish')?.textContent.trim(),
            collo: document.getElementById('execActiveCollo')?.textContent.trim(),
            gangguan: document.getElementById('execGangguanTotal')?.textContent.trim()
          };
        })()
      `,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 1000));
    console.log('Metrics after clicking 2026:', res2026.result.value);

    // 5. Test switching back to ALL
    const resAll = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pillAll = document.querySelector('#execPeriodQuickPills .exec-period-pill[data-period="ALL"]');
          if (pillAll) pillAll.click();
          return {
            sitac: document.getElementById('execSitacFinish')?.textContent.trim(),
            collo: document.getElementById('execActiveCollo')?.textContent.trim(),
            gangguan: document.getElementById('execGangguanTotal')?.textContent.trim()
          };
        })()
      `,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 1000));
    console.log('Metrics after clicking ALL:', resAll.result.value);

    // 6. Screenshot filter pills bar
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false
    });
    const snap = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 260, y: 70, width: 980, height: 180, scale: 1 }
    });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'verify_period_pills.png'), Buffer.from(snap.data, 'base64'));
    console.log('Saved screenshot to scratch/verify_period_pills.png');

    // Also capture light mode
    await send('Runtime.evaluate', {
      expression: `document.documentElement.setAttribute('data-theme', 'light');`
    });
    await new Promise(r => setTimeout(r, 600));
    const snapLight = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 260, y: 70, width: 980, height: 180, scale: 1 }
    });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'verify_period_pills_light.png'), Buffer.from(snapLight.data, 'base64'));
    console.log('Saved screenshot to scratch/verify_period_pills_light.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
