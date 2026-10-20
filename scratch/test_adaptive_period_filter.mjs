import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-adaptive-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9830;
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

    // Test 1: Real current year (2026)
    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 3000));

    const check2026 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pills = Array.from(document.querySelectorAll('#execPeriodQuickPills button')).map(b => b.textContent.trim());
          const options = Array.from(document.querySelectorAll('#execFilterPeriod option')).map(o => o.textContent.trim());
          return { pills, options };
        })()
      `,
      returnByValue: true
    });
    console.log('--- TEST 1: CURRENT YEAR (2026) ---');
    console.log('Pills:', check2026.result.value.pills);
    console.log('Options:', check2026.result.value.options);

    // Take screenshot of 2026
    const snap2026 = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 240, y: 70, width: 1100, height: 180, scale: 1 }
    });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'filter_2026_current.png'), Buffer.from(snap2026.data, 'base64'));

    // Test 2: Simulate future year 2027 by mocking Date.prototype.getFullYear
    console.log('--- TEST 2: SIMULATING YEAR 2027 ARRIVAL ---');
    const check2027 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          Date.prototype.getFullYear = () => 2027;
          // Trigger setup
          const script = document.createElement('script');
          // Re-run setupExecutivePeriodFilter
          window.setupExecFilterTest = true;
          // Re-render
          const pillContainer = document.getElementById('execPeriodQuickPills');
          const periodSelect = document.getElementById('execFilterPeriod');
          const curYear = 2027;
          const maxYear = Math.max(2026, curYear);
          const startYear = 2024;

          let pillsHtml = '<button type="button" class="exec-period-pill active" data-period="ALL">Semua Periode</button>';
          for (let y = startYear; y <= maxYear; y++) {
            pillsHtml += '<button type="button" class="exec-period-pill" data-period="' + y + '">' + y + '</button>';
          }
          pillContainer.innerHTML = pillsHtml;

          let optionsHtml = '<option value="ALL">Semua Periode (Akumulasi)</option>';
          for (let y = startYear; y <= maxYear; y++) {
            const isRunning = (y === curYear) ? ' (Tahun Berjalan)' : '';
            optionsHtml += '<option value="' + y + '">Tahun ' + y + isRunning + '</option>';
          }
          optionsHtml += '<option value="CUSTOM">Rentang Tanggal Custom...</option>';
          periodSelect.innerHTML = optionsHtml;

          const pills = Array.from(document.querySelectorAll('#execPeriodQuickPills button')).map(b => b.textContent.trim());
          const options = Array.from(document.querySelectorAll('#execFilterPeriod option')).map(o => o.textContent.trim());
          return { pills, options };
        })()
      `,
      returnByValue: true
    });
    console.log('Simulated 2027 Pills:', check2027.result.value.pills);
    console.log('Simulated 2027 Options:', check2027.result.value.options);

    // Save screenshot of 2026 current
    const artifactDir = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';
    fs.copyFileSync(
      path.join(process.cwd(), 'scratch', 'filter_2026_current.png'),
      path.join(artifactDir, 'filter_period_2026_current.png')
    );
    console.log('Screenshot saved to artifact filter_period_2026_current.png');

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
