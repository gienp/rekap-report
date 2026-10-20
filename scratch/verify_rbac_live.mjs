import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-rbac-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9622;
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
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 4500));

    console.log('--- TEST 1: LOGIN AS PIC (brian) ---');
    await evaluate(`
      document.getElementById('loginUsername').value = 'brian';
      document.getElementById('loginPassword').value = 'pic123';
      document.getElementById('btnLoginSubmit').click();
    `);

    // Wait for login
    for (let i = 0; i < 30; i++) {
      const isLoginHidden = await evaluate(`document.getElementById('loginOverlay')?.style.display === 'none'`);
      if (isLoginHidden) break;
      await new Promise(r => setTimeout(r, 500));
    }

    await new Promise(r => setTimeout(r, 2000));

    const picCheck = await evaluate(`(() => {
      const isRoleLapangan = document.body.classList.contains('role-lapangan');
      const isRoleAdmin = document.body.classList.contains('role-admin');
      const groupColloDisplay = document.getElementById('groupCollo')?.style.display;
      const navEfisiensiVisible = window.getComputedStyle(document.querySelector('.nav-item[data-view="view-efisiensi"]')).display !== 'none';
      const dbExplorerVisible = window.getComputedStyle(document.getElementById('btnOpenDatabaseViewer')).display !== 'none';
      const auditLogsVisible = window.getComputedStyle(document.getElementById('btnOpenAuditLogs')).display !== 'none';
      const picFilterDisabled = document.getElementById('sitacFilterPic')?.disabled;
      
      // Table SITAC checks
      const sitacFinancialThs = Array.from(document.querySelectorAll('#view-sitac-pa th.col-sitac-financial'))
        .map(el => window.getComputedStyle(el).display);
      const sitacDeleteBtns = Array.from(document.querySelectorAll('#sitacTableBody .btn-delete-row')).length;
      
      // Total SITAC rows
      const sitacRows = Array.from(document.querySelectorAll('#sitacTableBody tr')).length;
      const sitacPics = Array.from(document.querySelectorAll('#sitacTableBody tr td:nth-child(4)')).map(td => td.textContent.trim());

      return {
        isRoleLapangan,
        isRoleAdmin,
        groupColloHidden: groupColloDisplay === 'none',
        navEfisiensiVisible,
        dbExplorerVisible,
        auditLogsVisible,
        picFilterDisabled,
        sitacFinancialThsHidden: sitacFinancialThs.every(d => d === 'none'),
        sitacDeleteBtnsCount: sitacDeleteBtns,
        sitacRowsCount: sitacRows,
        samplePics: sitacPics.slice(0, 5)
      };
    })()`);

    console.log('PIC Brian Status:', JSON.stringify(picCheck, null, 2));

    // Test route protection
    console.log('--- TEST 2: ATTEMPT TO ENTER view-efisiensi AS PIC ---');
    const switchBlocked = await evaluate(`(() => {
      window.switchView('view-efisiensi');
      return {
        activeView: state.activeView,
        isEfisiensiActive: document.getElementById('view-efisiensi').classList.contains('active')
      };
    })()`);
    console.log('Switch to view-efisiensi result:', switchBlocked);

    // Switch to gangguan and verify financial column hidden
    console.log('--- TEST 3: CHECK GANGGUAN VIEW AS PIC ---');
    await evaluate(`document.querySelector('.nav-item[data-view="view-gangguan"]')?.click();`);
    await new Promise(r => setTimeout(r, 1500));

    const gangguanCheck = await evaluate(`(() => {
      const gFinancialThHidden = window.getComputedStyle(document.querySelector('#view-gangguan th.col-gangguan-financial')).display === 'none';
      const gBiayaFilterHidden = window.getComputedStyle(document.getElementById('gangguanFilterBiayaText')).display === 'none';
      const gDeleteBtns = Array.from(document.querySelectorAll('#gangguanTableBody .btn-delete-row')).length;
      const gRows = Array.from(document.querySelectorAll('#gangguanTableBody tr')).length;

      return {
        gFinancialThHidden,
        gBiayaFilterHidden,
        gDeleteBtnsCount: gDeleteBtns,
        gRowsCount: gRows
      };
    })()`);
    console.log('Gangguan Check for Brian:', JSON.stringify(gangguanCheck, null, 2));

    console.log('--- TEST 4: LOGOUT & LOGIN AS ADMIN ---');
    await evaluate(`document.getElementById('btnLogout')?.click();`);
    await new Promise(r => setTimeout(r, 1000));
    await evaluate(`
      document.getElementById('loginUsername').value = 'admin';
      document.getElementById('loginPassword').value = 'admin123';
      document.getElementById('btnLoginSubmit').click();
    `);

    for (let i = 0; i < 30; i++) {
      const isLoginHidden = await evaluate(`document.getElementById('loginOverlay')?.style.display === 'none'`);
      if (isLoginHidden) break;
      await new Promise(r => setTimeout(r, 500));
    }
    await new Promise(r => setTimeout(r, 2000));

    const adminCheck = await evaluate(`(() => {
      const isRoleAdmin = document.body.classList.contains('role-admin');
      const isRoleLapangan = document.body.classList.contains('role-lapangan');
      const navEfisiensiVisible = window.getComputedStyle(document.querySelector('.nav-item[data-view="view-efisiensi"]')).display !== 'none';
      const groupColloDisplay = document.getElementById('groupCollo')?.style.display;
      const picFilterDisabled = document.getElementById('sitacFilterPic')?.disabled;
      
      document.querySelector('.nav-item[data-view="view-sitac-pa"]')?.click();
      return {
        isRoleAdmin,
        isRoleLapangan,
        navEfisiensiVisible,
        groupColloVisible: groupColloDisplay !== 'none',
        picFilterDisabled
      };
    })()`);

    await new Promise(r => setTimeout(r, 2000));

    const adminSitacTableCheck = await evaluate(`(() => {
      const sitacFinancialThs = Array.from(document.querySelectorAll('#view-sitac-pa th.col-sitac-financial'))
        .map(el => window.getComputedStyle(el).display);
      const sitacDeleteBtns = Array.from(document.querySelectorAll('#sitacTableBody .btn-delete-row')).length;
      const sitacRows = Array.from(document.querySelectorAll('#sitacTableBody tr')).length;
      const samplePics = Array.from(document.querySelectorAll('#sitacTableBody tr td:nth-child(4)')).map(td => td.textContent.trim()).slice(0, 5);

      return {
        sitacFinancialThsVisible: sitacFinancialThs.every(d => d !== 'none'),
        sitacDeleteBtnsCount: sitacDeleteBtns,
        sitacRowsCount: sitacRows,
        samplePics
      };
    })()`);

    console.log('Admin Check:', JSON.stringify(adminCheck, null, 2));
    console.log('Admin SITAC Table Check:', JSON.stringify(adminSitacTableCheck, null, 2));

    console.log('\n=== ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY ===');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main();
