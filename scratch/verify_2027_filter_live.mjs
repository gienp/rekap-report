import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-2027-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9822;
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
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Auto login as admin
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        localStorage.setItem('telecom_portal_user', JSON.stringify({
          id: 1,
          username: 'admin',
          full_name: 'Administrator (Manajemen)',
          role: 'admin',
          email: 'admin@telecom.co.id'
        }));
        localStorage.setItem('portal_theme', 'dark');
      `
    });

    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 3500));

    // Check all pills and options
    const initialCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pills = Array.from(document.querySelectorAll('#execPeriodQuickPills button')).map(b => ({
            text: b.textContent.trim(),
            period: b.getAttribute('data-period'),
            active: b.classList.contains('active')
          }));
          const options = Array.from(document.querySelectorAll('#execFilterPeriod option')).map(o => ({
            value: o.value,
            text: o.textContent.trim()
          }));
          return { pills, options };
        })()
      `,
      returnByValue: true
    });
    console.log('INITIAL CHECK:', JSON.stringify(initialCheck.result.value, null, 2));

    // Click the '2027' pill
    console.log('Clicking 2027 pill...');
    const clickResult = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('#execPeriodQuickPills button[data-period="2027"]');
          if (btn) {
            btn.click();
            return { clicked: true, text: btn.textContent };
          }
          return { clicked: false };
        })()
      `,
      returnByValue: true
    });
    console.log('CLICK RESULT:', clickResult.result.value);

    // Wait 2.5s for fetch to complete and UI to render
    await new Promise(r => setTimeout(r, 2500));

    // Get current KPI values and card states
    const kpiValues = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const cards = Array.from(document.querySelectorAll('.bento-kpi-card, .exec-kpi-card')).map(c => {
            const label = c.querySelector('.kpi-title, .bento-kpi-label, .kpi-label')?.textContent.trim();
            const val = c.querySelector('.kpi-val, .bento-kpi-val, .kpi-value')?.textContent.trim();
            const sub = c.querySelector('.kpi-sub, .bento-kpi-sub')?.textContent.trim();
            return { label, val, sub };
          });
          const badge = document.querySelector('#execPeriodBadge')?.textContent.trim();
          const activePill = document.querySelector('#execPeriodQuickPills button.active')?.textContent.trim();
          return { badge, activePill, cards };
        })()
      `,
      returnByValue: true
    });
    console.log('KPI VALUES FOR 2027:', JSON.stringify(kpiValues.result.value, null, 2));

    // Take full top-half screenshot (KPI cards + filter pill bar)
    const snap = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 240, y: 0, width: 1200, height: 750, scale: 1 }
    });
    const outPath = path.join(process.cwd(), 'scratch', 'verify_2027_filter_live.png');
    fs.writeFileSync(outPath, Buffer.from(snap.data, 'base64'));
    console.log('Screenshot saved to', outPath);

    // Copy to brain artifacts
    const artifactDir = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';
    const artifactPath = path.join(artifactDir, 'dashboard_ringkasan_2027_verified.png');
    fs.copyFileSync(outPath, artifactPath);
    console.log('Copied to artifact:', artifactPath);

    ws.close();
  } finally {
    try { edgeProc.kill(); } catch (e) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
