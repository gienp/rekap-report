import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-capture-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9850;
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

    async function screenshot(filename) {
      const snap = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filename, Buffer.from(snap.data, 'base64'));
      console.log('Saved:', filename);
    }

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false
    });

    const filePath = path.join(process.cwd(), 'index.html').replace(/\\/g, '/');
    await send('Page.navigate', { url: `file:///${filePath}` });
    await new Promise(r => setTimeout(r, 2500));

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
    await new Promise(r => setTimeout(r, 1500));
    await screenshot('scratch/final_dashboard_view.png');

    // 2. Open Pick Add Modal
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('btnOpenAddModal').click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));
    await screenshot('scratch/final_modal_pick_add.png');

    // Close Pick Add Modal
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('btnClosePickAdd').click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 400));

    // 3. Open Update My Email Modal
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('btnOpenUpdateEmail').click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));
    await screenshot('scratch/final_modal_update_my_email.png');

    // Close Update My Email Modal
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('btnCloseUpdateEmail').click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 400));

    // 4. Open Admin Users Modal and switch to Kelola Email PIC
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btnAdminUsers = document.getElementById('btnOpenAdminUsers') || document.getElementById('btnManageUsers');
          if (btnAdminUsers) {
            btnAdminUsers.click();
          } else {
            document.getElementById('modalAdminUsers').style.display = 'flex';
          }
          switchAdminTab('email');
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));
    await screenshot('scratch/final_admin_tab_email.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
