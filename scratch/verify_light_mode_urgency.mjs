import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  console.log('=== VERIFY LIGHT MODE URGENCY TABLE ===');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-urgency-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9595;
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
    const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
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

    // Fill login and submit
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

    // Set light mode & click Jatuh Tempo Kontrak
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.documentElement.setAttribute('data-theme', 'light');
          localStorage.setItem('portal_theme', 'light');

          // Expand groupCollo if collapsed
          const grp = document.getElementById('groupCollo');
          if (grp) grp.classList.remove('collapsed');

          // Click nav item
          const navBtn = document.querySelector('button.nav-item[data-view="view-collo-alerts"]');
          if (navBtn) navBtn.click();
        })()
      `
    });

    await new Promise(r => setTimeout(r, 2000));

    // Filter by EXPIRED category
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const expBtn = document.querySelector('.alert-filter-card[data-alert-cat="EXPIRED"]');
          if (expBtn) expBtn.click();
        })()
      `
    });

    await new Promise(r => setTimeout(r, 2000));

    // Scroll to the table
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const tbl = document.getElementById('alertTableBody');
          if (tbl) tbl.scrollIntoView({ behavior: 'instant', block: 'center' });
        })()
      `
    });

    await new Promise(r => setTimeout(r, 1000));

    // Capture screenshot
    const snap = await send('Page.captureScreenshot', { format: 'png', quality: 90 });
    fs.writeFileSync('scratch/verified_light_mode_urgency_fixed.png', Buffer.from(snap.data, 'base64'));
    console.log('Saved screenshot: scratch/verified_light_mode_urgency_fixed.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
