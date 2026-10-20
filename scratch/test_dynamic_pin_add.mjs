import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  console.log('--- Testing Live Dynamic Pin Addition via Form ---');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-add-pin-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9597;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1600,1050',
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

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1050, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://localhost:8888/index.html' });
    await new Promise(r => setTimeout(r, 3000));

    // 1. Login
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('loginUsername').value = 'admin';
          document.getElementById('loginPassword').value = 'admin123';
          document.getElementById('btnLoginSubmit').click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // 2. Navigate to WebGIS
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('btnCloseDailyBanner')?.click();
          document.querySelector('button[data-view="view-webgis"]')?.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2500));

    const countBefore = await send('Runtime.evaluate', {
      expression: `document.getElementById('mapPinCount')?.textContent.trim()`,
      returnByValue: true
    });
    console.log('Pin count before add:', countBefore.result?.value);

    // 3. Open modalAddSitac and submit a new record with GPS coordinates
    console.log('Submitting new SITAC with GPS coordinates (-6.2185, 106.8025, status: Ongoing)...');
    const addResult = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const form = document.getElementById('formAddSitac');
          if (!form) return { error: 'formAddSitac not found' };

          // Fill form fields
          form.querySelector('input[name="no_pa"]').value = 'PA-TEST-DYNAMIC-999';
          form.querySelector('input[name="pelanggan"]').value = 'PT Dynamic Pin Verification';
          form.querySelector('select[name="progress"]').value = 'Ongoing';
          form.querySelector('input[name="terminating"]').value = 'Gelora Bung Karno Senayan';
          form.querySelector('input[name="latitude"]').value = '-6.218500';
          form.querySelector('input[name="longitude"]').value = '106.802500';
          form.querySelector('input[name="date_dispos"]').value = '2026-10-12';
          form.querySelector('input[name="pic_perijinan"]').value = 'Harlan Zaelani';

          // Trigger submit event
          const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
          form.dispatchEvent(submitEvent);

          return { submitted: true };
        })()
      `,
      returnByValue: true,
      awaitPromise: true
    });
    console.log('Add submission triggered:', addResult.result?.value);

    await new Promise(r => setTimeout(r, 3000));

    // 4. Check WebGIS Map Pin Count
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.querySelector('button[data-view="view-webgis"]')?.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    const countAfter = await send('Runtime.evaluate', {
      expression: `document.getElementById('mapPinCount')?.textContent.trim()`,
      returnByValue: true
    });
    console.log('Pin count after add:', countAfter.result?.value);

    // 5. Filter to Ongoing only
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btnOngoing = document.querySelector('.map-tag-btn[data-status="Ongoing"]');
          if (btnOngoing) btnOngoing.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    const ongoingCount = await send('Runtime.evaluate', {
      expression: `document.getElementById('mapPinCount')?.textContent.trim()`,
      returnByValue: true
    });
    console.log('Ongoing pin count (should include the new pin):', ongoingCount.result?.value);

    // 6. Screenshot of Ongoing pins
    const screenshot = await send('Page.captureScreenshot', { format: 'png', quality: 90 });
    const screenshotPath = path.resolve('scratch/test_dynamic_ongoing_pin.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`Screenshot saved: ${screenshotPath}`);

    // Cleanup: delete the test record from SQLite
    console.log('Cleaning up test record...');
    const connRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          try {
            const listRes = await fetch('/api/sitac');
            const data = await listRes.json();
            const testRec = (data.data || []).find(s => s.no_pa === 'PA-TEST-DYNAMIC-999');
            if (testRec) {
              await fetch('/api/sitac/' + testRec.id, { method: 'DELETE' });
              return { cleaned: true, id: testRec.id };
            }
          } catch (e) {
            return { error: e.message };
          }
          return { notFound: true };
        })()
      `,
      returnByValue: true,
      awaitPromise: true
    });
    console.log('Cleanup result:', connRes.result?.value);

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
