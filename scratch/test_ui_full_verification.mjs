import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function testUI() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-ui-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9592;

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

    // 1. TEST ADMIN
    console.log('--- TEST 1: ADMIN LOGIN & PERMISSIONS ---');
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

    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 2500));

    // Navigate to SITAC view as admin
    await send('Runtime.evaluate', {
      expression: `
        const navSitac = document.querySelector('.nav-item[data-view="view-sitac"]');
        if (navSitac) navSitac.click();
      `
    });
    await new Promise(r => setTimeout(r, 500));

    // Check SITAC as admin
    const adminSitacCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const btn = document.getElementById('btnSitacMyTasks');
          const isHidden = btn ? (btn.classList.contains('hidden') || btn.style.display === 'none') : true;
          return { exists: !!btn, isHidden: isHidden };
        })()
      `,
      returnByValue: true
    });
    console.log('Admin SITAC My Tasks button hidden:', adminSitacCheck.result.value);

    // Navigate to Gangguan view as admin
    await send('Runtime.evaluate', {
      expression: `
        const navGangguan = document.querySelector('.nav-item[data-view="view-gangguan"]');
        if (navGangguan) navGangguan.click();
      `
    });
    await new Promise(r => setTimeout(r, 500));

    // Check Gangguan as admin
    const adminGangguanCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const btn = document.getElementById('btnGangguanMyTasks');
          const isHidden = btn ? (btn.classList.contains('hidden') || btn.style.display === 'none') : true;
          return { exists: !!btn, isHidden: isHidden };
        })()
      `,
      returnByValue: true
    });
    console.log('Admin Gangguan My Tasks button hidden:', adminGangguanCheck.result.value);

    // Open Admin Modal and check Email Tab
    const adminModalCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const btnOpenModal = document.getElementById('btnAdminManageUsers') || document.getElementById('btnUserManagement');
          if (btnOpenModal) btnOpenModal.click();
          const tabEmail = document.getElementById('tabPicEmail');
          if (!tabEmail) return { tabFound: false };
          tabEmail.click();
          const panel = document.getElementById('tabPanelEmail');
          const isPanelVisible = panel && !panel.classList.contains('hidden');
          const sel = document.getElementById('adminEmailTargetUser');
          const optionsCount = sel ? sel.options.length : 0;
          return {
            tabFound: true,
            panelVisible: isPanelVisible,
            optionsCount: optionsCount
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Admin Modal Email Tab:', adminModalCheck.result.value);

    // Check Profile Dropdown Perbarui Email Modal
    const profileModalCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const btnOpen = document.getElementById('btnOpenUpdateEmail');
          if (!btnOpen) return { btnFound: false };
          btnOpen.click();
          const modal = document.getElementById('modalUpdateMyEmail');
          const isModalOpen = modal && !modal.classList.contains('hidden');
          const currEmail = document.getElementById('myCurrentEmailDisplay')?.value;
          return {
            btnFound: true,
            modalOpen: isModalOpen,
            currentEmail: currEmail
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Profile Perbarui Email Modal:', profileModalCheck.result.value);

    // 2. TEST PIC (LAPANGAN)
    console.log('\n--- TEST 2: PIC (LAPANGAN) LOGIN & PERMISSIONS ---');
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

    // Navigate to SITAC view as PIC
    await send('Runtime.evaluate', {
      expression: `
        const navSitac = document.querySelector('.nav-item[data-view="view-sitac"]');
        if (navSitac) navSitac.click();
      `
    });
    await new Promise(r => setTimeout(r, 800));

    // Check SITAC as PIC
    const picSitacCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const btn = document.getElementById('btnSitacMyTasks');
          const isVisible = btn && !btn.classList.contains('hidden') && btn.style.display !== 'none';
          const isActive = btn && btn.classList.contains('active');
          const isLocked = btn && btn.classList.contains('cursor-default');
          return { exists: !!btn, isVisible, isActive, isLocked };
        })()
      `,
      returnByValue: true
    });
    console.log('PIC SITAC My Tasks button state:', picSitacCheck.result.value);

    // Navigate to Gangguan view as PIC
    await send('Runtime.evaluate', {
      expression: `
        const navGangguan = document.querySelector('.nav-item[data-view="view-gangguan"]');
        if (navGangguan) navGangguan.click();
      `
    });
    await new Promise(r => setTimeout(r, 800));

    // Check Gangguan as PIC
    const picGangguanCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const btn = document.getElementById('btnGangguanMyTasks');
          const isVisible = btn && !btn.classList.contains('hidden') && btn.style.display !== 'none';
          const isActive = btn && btn.classList.contains('active');
          const isLocked = btn && btn.classList.contains('cursor-default');
          return { exists: !!btn, isVisible, isActive, isLocked };
        })()
      `,
      returnByValue: true
    });
    console.log('PIC Gangguan My Tasks button state:', picGangguanCheck.result.value);

    // Check Profile Dropdown Perbarui Email Modal for PIC
    const picProfileModalCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const btnOpen = document.getElementById('btnOpenUpdateEmail');
          if (!btnOpen) return { btnFound: false };
          btnOpen.click();
          const modal = document.getElementById('modalUpdateMyEmail');
          const isModalOpen = modal && !modal.classList.contains('hidden');
          const currEmail = document.getElementById('myCurrentEmailDisplay')?.value;
          return {
            btnFound: true,
            modalOpen: isModalOpen,
            currentEmail: currEmail
          };
        })()
      `,
      returnByValue: true
    });
    console.log('PIC Profile Perbarui Email Modal:', picProfileModalCheck.result.value);

    // Capture screenshot of PIC modal
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/verify_pic_email_modal.png', Buffer.from(shot.data, 'base64'));
    console.log('Screenshot saved to scratch/verify_pic_email_modal.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

testUI().then(() => console.log('UI Verification completed successfully!')).catch(console.error);
