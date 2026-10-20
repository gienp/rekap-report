import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-latest-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9845;
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

    const consoleLogs = [];
    ws.addEventListener('message', (e) => {
      const data = JSON.parse(e.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        const text = data.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
        consoleLogs.push(`[${data.params.type}] ${text}`);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });

    const filePath = path.join(process.cwd(), 'index.html').replace(/\\/g, '/');
    await send('Page.navigate', { url: `file:///${filePath}` });
    await new Promise(r => setTimeout(r, 2500));

    // 1. Check Login
    const loginRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('loginUsername').value = 'admin';
          document.getElementById('loginPassword').value = 'admin123';
          document.getElementById('btnLoginSubmit').click();
          return { status: 'logged_in' };
        })()
      `,
      returnByValue: true
    });
    console.log('Login action result:', loginRes.result.value);
    await new Promise(r => setTimeout(r, 1500));

    // 2. Test modalPickAddType and buttons
    const pickAddRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btnAdd = document.getElementById('btnOpenAddModal');
          if (btnAdd) btnAdd.click();
          const modalPick = document.getElementById('modalPickAddType');
          const pickDisplay = modalPick ? window.getComputedStyle(modalPick).display : null;
          
          const btnPickCollo = document.getElementById('btnPickCollo');
          const btnPickSitac = document.getElementById('btnPickSitac');
          
          // Click btnPickCollo
          if (btnPickCollo) btnPickCollo.click();
          const modalAddCollo = document.getElementById('modalAddCollo');
          const colloDisplay = modalAddCollo ? window.getComputedStyle(modalAddCollo).display : null;
          if (modalAddCollo) modalAddCollo.style.display = 'none';

          return {
            modalPickFound: !!modalPick,
            pickDisplay,
            btnPickColloFound: !!btnPickCollo,
            btnPickSitacFound: !!btnPickSitac,
            colloDisplayAfterClick: colloDisplay
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Pick Add Modal test:', pickAddRes.result.value);

    // 3. Test modalUpdateMyEmail
    const emailModalRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btnOpenUpdateEmail = document.getElementById('btnOpenUpdateEmail');
          const btnOpenUpdateEmailMobile = document.getElementById('btnOpenUpdateEmailMobile');
          if (btnOpenUpdateEmail) btnOpenUpdateEmail.click();
          const modalUpdateMyEmail = document.getElementById('modalUpdateMyEmail');
          const emailDisplay = modalUpdateMyEmail ? window.getComputedStyle(modalUpdateMyEmail).display : null;
          const currentEmailVal = document.getElementById('myCurrentEmailDisplay')?.value;
          if (modalUpdateMyEmail) modalUpdateMyEmail.style.display = 'none';

          return {
            btnOpenUpdateEmailFound: !!btnOpenUpdateEmail,
            btnOpenUpdateEmailMobileFound: !!btnOpenUpdateEmailMobile,
            modalUpdateMyEmailFound: !!modalUpdateMyEmail,
            emailDisplayAfterClick: emailDisplay,
            currentEmailVal
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Update My Email Modal test:', emailModalRes.result.value);

    // 4. Test Admin DB modal & Email Tab
    const adminDbTabRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const modalUsers = document.getElementById('modalAdminUsers');
          if (modalUsers) modalUsers.style.display = 'flex';
          const tabBtn = document.getElementById('tabPicEmail');
          if (tabBtn) tabBtn.click();
          const tabPanel = document.getElementById('tabPanelEmail');
          const panelDisplay = tabPanel ? window.getComputedStyle(tabPanel).display : null;
          const targetUserSelect = document.getElementById('adminEmailTargetUser');
          const optCount = targetUserSelect ? targetUserSelect.options.length : 0;
          if (modalUsers) modalUsers.style.display = 'none';

          return {
            modalUsersFound: !!modalUsers,
            tabBtnFound: !!tabBtn,
            tabPanelFound: !!tabPanel,
            panelDisplayAfterClick: panelDisplay,
            optCount
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Admin Users Email Tab test:', adminDbTabRes.result.value);

    // Check for any JS errors in console
    const jsErrors = consoleLogs.filter(l => l.startsWith('[error]'));
    console.log('Total console logs:', consoleLogs.length);
    console.log('Console Errors:', jsErrors);

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
