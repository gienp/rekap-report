import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-case-dedup-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9603;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1600,1000',
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
    await send('DOM.enable');
    console.log('Navigating to live app...');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 5000));

    console.log('Logging in as admin...');
    const loginRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const user = { username: 'admin', role: 'admin', name: 'Administrator' };
          localStorage.setItem('telecom_portal_user', JSON.stringify(user));
          if (window.AuthManager) {
            window.AuthManager.currentUser = user;
          }
          if (window.Router) {
            window.Router.navigate('view-collo-list');
          }
          return { loggedIn: true };
        })()
      `,
      returnByValue: true
    });
    console.log('Login result:', loginRes.result?.value);
    await new Promise(r => setTimeout(r, 4000));

    console.log('Searching for Supra Primatama in collo table...');
    const searchRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const searchInput = document.getElementById('searchCollo');
          if (searchInput) {
            searchInput.value = 'A821204000046';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          return { searchApplied: !!searchInput };
        })()
      `,
      returnByValue: true
    });
    console.log('Search applied:', searchRes.result?.value);
    await new Promise(r => setTimeout(r, 2000));

    const checkRowsRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const tbody = document.getElementById('colloTableBody');
          if (!tbody) return { error: 'No table body' };
          const rows = Array.from(tbody.querySelectorAll('tr'));
          const rowData = rows.map(r => {
            const cells = Array.from(r.querySelectorAll('td')).map(td => td.innerText.trim());
            return {
              text: r.innerText.replace(/\\s+/g, ' '),
              cells: cells.slice(0, 6)
            };
          });
          return {
            totalVisibleRows: rows.length,
            rows: rowData
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Visible rows for A821204000046:', JSON.stringify(checkRowsRes.result?.value, null, 2));

    // Capture screenshot of table
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const imgBuffer = Buffer.from(screenshot.data, 'base64');
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'live_supra_primatama_deduped.png'), imgBuffer);
    console.log('Saved scratch/live_supra_primatama_deduped.png');

    // Also check Bukalapak search
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const searchInput = document.getElementById('searchCollo');
          if (searchInput) {
            searchInput.value = 'Bukalapak';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    const checkBukaRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const tbody = document.getElementById('colloTableBody');
          const rows = Array.from(tbody?.querySelectorAll('tr') || []);
          return {
            bukaRowCount: rows.length,
            rows: rows.map(r => r.innerText.replace(/\\s+/g, ' '))
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Bukalapak search rows:', JSON.stringify(checkBukaRes.result?.value, null, 2));

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
