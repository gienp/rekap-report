import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function testRoleAndEmail() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-role-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9593;

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

    let id = 1;
    const send = (m, p = {}) => new Promise((resolve, reject) => {
      const mid = id++;
      const handler = e => {
        const d = JSON.parse(e.data);
        if (d.id === mid) {
          ws.removeEventListener('message', handler);
          d.error ? reject(d.error) : resolve(d.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: mid, method: m, params: p }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // 1. ADMIN TEST
    console.log('\n=== TEST 1: ADMIN ROLE ===');
    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 1500));

    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('telecom_portal_user', JSON.stringify({
          id: 1,
          username: 'admin',
          full_name: 'Administrator (Manajemen)',
          role: 'admin',
          email: 'admin@telecom.co.id'
        }));
        location.reload();
      `
    });
    await new Promise(r => setTimeout(r, 2500));

    const adminCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const user = JSON.parse(localStorage.getItem('telecom_portal_user') || '{}');
          const btnS = document.getElementById('btnSitacMyTasks');
          const btnG = document.getElementById('btnGangguanMyTasks');
          return {
            loggedUser: user.username,
            role: user.role,
            btnS_display: btnS ? btnS.style.display : null,
            btnG_display: btnG ? btnG.style.display : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Admin Check:', adminCheck.result.value);

    // Test Admin Email Tab in modal
    const adminTabEmailCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const btnManage = document.getElementById('btnAdminManageUsers');
          if (btnManage) btnManage.click();
          const tabEmail = document.getElementById('tabPicEmail');
          if (tabEmail) tabEmail.click();
          const panel = document.getElementById('tabPanelEmail');
          const select = document.getElementById('adminEmailTargetUser');
          const selectOptions = Array.from(select ? select.options : []).map(o => ({ val: o.value, text: o.text }));
          return {
            panelIsHidden: panel ? panel.classList.contains('hidden') : null,
            optionsCount: selectOptions.length,
            sampleOptions: selectOptions.slice(0, 4)
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Admin Tab Email Check:', adminTabEmailCheck.result.value);

    // 2. PIC (HARLAN) TEST
    console.log('\n=== TEST 2: PIC (HARLAN) ROLE ===');
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('telecom_portal_user', JSON.stringify({
          id: 3,
          username: 'harlan',
          full_name: 'Harlan',
          role: 'lapangan',
          pic_code: 'Harlan',
          email: 'harlan.official@telecom.co.id'
        }));
        location.reload();
      `
    });
    await new Promise(r => setTimeout(r, 2500));

    const picCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const user = JSON.parse(localStorage.getItem('telecom_portal_user') || '{}');
          const btnS = document.getElementById('btnSitacMyTasks');
          const btnG = document.getElementById('btnGangguanMyTasks');
          return {
            loggedUser: user.username,
            role: user.role,
            btnS_display: btnS ? btnS.style.display : null,
            btnS_hasActive: btnS ? btnS.classList.contains('active') : false,
            btnS_pointerEvents: btnS ? btnS.style.pointerEvents : null,
            btnG_display: btnG ? btnG.style.display : null,
            btnG_hasActive: btnG ? btnG.classList.contains('active') : false,
            btnG_pointerEvents: btnG ? btnG.style.pointerEvents : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('PIC Check:', picCheck.result.value);

    // Test PIC Profile Update Email Modal
    const picEmailModalCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const btnOpen = document.getElementById('btnOpenUpdateEmail');
          if (btnOpen) btnOpen.click();
          const modal = document.getElementById('modalUpdateMyEmail');
          const displayEmail = document.getElementById('myCurrentEmailDisplay')?.value;
          return {
            modalVisible: modal ? !modal.classList.contains('hidden') : false,
            currentEmailInField: displayEmail
          };
        })()
      `,
      returnByValue: true
    });
    console.log('PIC Email Modal Check:', picEmailModalCheck.result.value);

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/verify_pic_email_modal_clean.png', Buffer.from(shot.data, 'base64'));
    console.log('Screenshot saved to scratch/verify_pic_email_modal_clean.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

testRoleAndEmail().then(() => console.log('\nAll role & email tests passed!')).catch(console.error);
