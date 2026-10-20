import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-approval-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9812;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--force-device-scale-factor=1',
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 667,
      deviceScaleFactor: 1,
      mobile: true
    });

    console.log('Navigating to http://localhost:8888 ...');
    await send('Page.navigate', { url: 'http://localhost:8888' });
    await new Promise(r => setTimeout(r, 3500));

    // 1. Check Registration Tab
    console.log('Checking registration tab...');
    await send('Runtime.evaluate', {
      expression: `document.getElementById('tabModeRegister')?.click()`
    });
    await new Promise(r => setTimeout(r, 1000));

    const checkPane = await send('Runtime.evaluate', {
      expression: `JSON.stringify({
        infoBoxExists: !!document.querySelector('#paneRegister')?.innerText.includes('Pendaftaran Akun PIC Baru (Firebase)'),
        buttonText: document.getElementById('btnRegisterSubmit')?.innerText.trim()
      })`,
      returnByValue: true
    });
    console.log('Pane Register check:', checkPane.result.value);

    // Capture registration tab screenshot
    const shotReg = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/verify_register_pane.png', Buffer.from(shotReg.data, 'base64'));
    console.log('Saved scratch/verify_register_pane.png');

    // 2. Check Daily Contract Alert Banner positioning
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const b = document.getElementById('dailyContractAlertBanner');
          if (b) {
            b.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-10');
            b.style.display = 'block';
          }
        })()
      `
    });
    await new Promise(r => setTimeout(r, 800));

    const bannerMetrics = await send('Runtime.evaluate', {
      expression: `JSON.stringify((() => {
        const b = document.getElementById('dailyContractAlertBanner');
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width, bottom: r.bottom, top: r.top };
      })())`,
      returnByValue: true
    });
    console.log('Banner metrics on 375px mobile screen:', bannerMetrics.result.value);

    // Capture banner screenshot
    const shotBanner = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/verify_banner_position.png', Buffer.from(shotBanner.data, 'base64'));
    console.log('Saved scratch/verify_banner_position.png');

    // 3. Login as Admin and test Persetujuan tab in Modal Admin
    console.log('Testing Admin Approval Modal...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('tabModeLogin')?.click();
          const u = document.getElementById('loginUsername');
          const p = document.getElementById('loginPassword');
          if (u) u.value = 'admin';
          if (p) p.value = 'admin123';
          document.getElementById('formLogin')?.dispatchEvent(new Event('submit', { cancelable: true }));
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2500));

    // Open Admin modal
    await send('Runtime.evaluate', {
      expression: `document.getElementById('btnOpenAdminUsers')?.click()`
    });
    await new Promise(r => setTimeout(r, 1200));

    const adminCheck = await send('Runtime.evaluate', {
      expression: `JSON.stringify({
        modalOpen: document.getElementById('modalAdminUsers')?.style.display,
        tabPendingActive: document.getElementById('tabPendingUsers')?.className.includes('border-emerald-400'),
        panelPendingVisible: !document.getElementById('tabPanelPending')?.classList.contains('hidden'),
        containerContent: document.getElementById('adminPendingListContainer')?.innerText.trim().slice(0, 100)
      })`,
      returnByValue: true
    });
    console.log('Admin Modal check:', adminCheck.result.value);

    const shotAdmin = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/verify_admin_approval_modal.png', Buffer.from(shotAdmin.data, 'base64'));
    console.log('Saved scratch/verify_admin_approval_modal.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
