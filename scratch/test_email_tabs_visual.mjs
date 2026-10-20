import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-email-tabs-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9855;
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
      width: 1280,
      height: 850,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Navigating to http://localhost:8888 ...');
    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 2500));

    // Log in as admin
    console.log('Logging in as admin...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const u = document.getElementById('loginUsername');
          const p = document.getElementById('loginPassword');
          if (u) u.value = 'admin';
          if (p) p.value = 'admin123';
          document.getElementById('btnLoginSubmit')?.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Open Admin Modal and click tabPicEmail
    console.log('Opening Admin Modal & switching to Email tab...');
    const emailTabCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('btnOpenAdminUsers')?.click();
          document.getElementById('tabPicEmail')?.click();
          const panel = document.getElementById('tabPanelEmail');
          const select = document.getElementById('adminEmailTargetUser');
          const list = document.getElementById('adminEmailPicListContainer');
          return {
            modalVisible: document.getElementById('modalAdminUsers')?.style.display !== 'none',
            panelVisible: !panel?.classList.contains('hidden'),
            optionsCount: select?.options?.length || 0,
            listChildrenCount: list?.children?.length || 0,
            summaryCountText: document.getElementById('adminEmailSummaryCount')?.textContent || ''
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Email Tab Status:', emailTabCheck.result.value);

    // Wait a bit for async user list loading
    await new Promise(r => setTimeout(r, 1500));

    // Re-check after fetch
    const emailTabLoaded = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const select = document.getElementById('adminEmailTargetUser');
          const list = document.getElementById('adminEmailPicListContainer');
          return {
            optionsCount: select?.options?.length || 0,
            listChildrenCount: list?.children?.length || 0,
            summaryCountText: document.getElementById('adminEmailSummaryCount')?.textContent || ''
          };
        })()
      `,
      returnByValue: true
    });
    console.log('After async load:', emailTabLoaded.result.value);

    // Select the first PIC in the dropdown to trigger card & auto-suggest
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const select = document.getElementById('adminEmailTargetUser');
          if (select && select.options.length > 1) {
            select.selectedIndex = 1;
            select.dispatchEvent(new Event('change'));
          }
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));

    // Capture screenshot of Admin Email tab
    const snapAdminEmail = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'admin_email_tab_verified.png'), Buffer.from(snapAdminEmail.data, 'base64'));
    console.log('Captured scratch/admin_email_tab_verified.png');

    // Close admin modal and open user own email modal
    console.log('Opening modalUpdateMyEmail...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('btnCloseAdminUsers')?.click();
          document.getElementById('btnOpenUpdateEmail')?.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));

    // Click auto suggest on user own email modal
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('btnMyEmailAutoSuggest')?.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 400));

    const snapMyEmail = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'modal_update_my_email_verified.png'), Buffer.from(snapMyEmail.data, 'base64'));
    console.log('Captured scratch/modal_update_my_email_verified.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
