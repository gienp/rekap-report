import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-reg-search-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9620;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1600,1100',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2500));
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
      width: 1500,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Navigating to http://localhost:8888...');
    await send('Page.navigate', { url: 'http://localhost:8888' });
    await new Promise(r => setTimeout(r, 3000));

    // Login as admin
    console.log('Logging in as admin...');
    await evaluate(`
      document.getElementById('loginUsername').value = 'admin';
      document.getElementById('loginPassword').value = 'admin123';
      document.getElementById('btnLoginSubmit').click();
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Dismiss reminder popup if open
    await evaluate(`
      const closeBtns = document.querySelectorAll('.reminder-banner-close, [data-dismiss="reminder"], .btn-reminder-dismiss');
      closeBtns.forEach(b => b.click());
      const reminder = document.getElementById('reminderDailyModal') || document.querySelector('.reminder-overlay');
      if (reminder) reminder.remove();
    `);

    // Switch to view-collo-list
    console.log('Switching to view-collo-list...');
    await evaluate(`
      const navItem = document.querySelector('[data-view="view-collo-list"]');
      if (navItem) navItem.click();
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Test Search "Bandung"
    console.log('Searching for "Bandung"...');
    await evaluate(`
      const inp = document.getElementById('colloSearchInput');
      inp.value = 'Bandung';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      // Scroll to table container
      document.getElementById('colloSearchInput').scrollIntoView({ behavior: 'instant', block: 'start' });
    `);
    await new Promise(r => setTimeout(r, 1500));

    // Screenshot Bandung in Dark Mode
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea\\collo_search_bandung_dark.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved collo_search_bandung_dark.png');

    // Test Search "Bogor"
    console.log('Searching for "Bogor"...');
    await evaluate(`
      const inp = document.getElementById('colloSearchInput');
      inp.value = 'Bogor';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    `);
    await new Promise(r => setTimeout(r, 1500));

    // Switch to light mode and screenshot
    console.log('Switching to light mode...');
    await evaluate(`
      document.documentElement.setAttribute('data-theme', 'light');
    `);
    await new Promise(r => setTimeout(r, 800));

    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea\\collo_search_bogor_light.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved collo_search_bogor_light.png');

    ws.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edgeProc.kill();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

main();
