import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-e2e-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9815;
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
      width: 412,
      height: 840,
      deviceScaleFactor: 1,
      mobile: true
    });

    // Auto-accept window.confirm
    await send('Page.setDownloadBehavior', { behavior: 'deny' });
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.method === 'Page.javascriptDialogOpening') {
        send('Page.handleJavaScriptDialog', { accept: true });
      }
    });

    console.log('Navigating to http://localhost:8888 ...');
    await send('Page.navigate', { url: 'http://localhost:8888' });
    await new Promise(r => setTimeout(r, 3500));

    // STEP 1: Register new PIC account
    console.log('--- STEP 1: Registering PIC account test_pic_pending ---');
    await send('Runtime.evaluate', {
      expression: `document.getElementById('tabModeRegister')?.click()`
    });
    await new Promise(r => setTimeout(r, 800));

    const regResult = await send('Runtime.evaluate', {
      expression: `(async () => {
        document.getElementById('regFullName').value = 'Budi Wicaksono';
        document.getElementById('regUsername').value = 'budi_ops';
        document.getElementById('regEmail').value = 'budi@telecom.ops';
        document.getElementById('regPassword').value = 'Password123!';
        document.getElementById('regPasswordConfirm').value = 'Password123!';
        
        document.getElementById('formRegister').dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(r => setTimeout(r, 2000));
        return {
          succHidden: document.getElementById('loginSuccessAlert')?.classList.contains('hidden'),
          succText: document.getElementById('loginSuccessMsg')?.innerText,
          errHidden: document.getElementById('loginErrorAlert')?.classList.contains('hidden'),
          errText: document.getElementById('loginErrorMsg')?.innerText
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Registration submitted result:', regResult.result.value);

    // STEP 2: Try to login before approval
    console.log('--- STEP 2: Attempting login before approval ---');
    await new Promise(r => setTimeout(r, 2500)); // wait for auto-switch to login tab
    const loginFailResult = await send('Runtime.evaluate', {
      expression: `(async () => {
        document.getElementById('loginUsername').value = 'budi_ops';
        document.getElementById('loginPassword').value = 'Password123!';
        document.getElementById('formLogin').dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(r => setTimeout(r, 2000));
        return {
          errHidden: document.getElementById('loginErrorAlert')?.classList.contains('hidden'),
          errText: document.getElementById('loginErrorMsg')?.innerText
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Login attempt result (should be blocked as pending):', loginFailResult.result.value);

    // STEP 3: Admin logs in and views approval tab
    console.log('--- STEP 3: Admin login to review pending account ---');
    await send('Runtime.evaluate', {
      expression: `(async () => {
        document.getElementById('loginUsername').value = 'admin';
        document.getElementById('loginPassword').value = 'admin123';
        document.getElementById('formLogin').dispatchEvent(new Event('submit', { cancelable: true }));
      })()`
    });
    await new Promise(r => setTimeout(r, 2500));

    // Open Admin Modal
    await send('Runtime.evaluate', {
      expression: `document.getElementById('btnOpenAdminUsers')?.click()`
    });
    await new Promise(r => setTimeout(r, 1500));

    const checkPendingCard = await send('Runtime.evaluate', {
      expression: `JSON.stringify({
        hasPendingCard: !!document.getElementById('cardPending_budi_ops'),
        containerText: document.getElementById('adminPendingListContainer')?.innerText.trim().slice(0, 150)
      })`,
      returnByValue: true
    });
    console.log('Admin pending approval check:', checkPendingCard.result.value);

    const shotPending = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/verify_admin_pending_approval_live.png', Buffer.from(shotPending.data, 'base64'));
    console.log('Saved scratch/verify_admin_pending_approval_live.png');

    // STEP 4: Admin clicks "Setujui"
    console.log('--- STEP 4: Admin approves budi_ops ---');
    await send('Runtime.evaluate', {
      expression: `(async () => {
        // Mock confirm
        window.confirm = () => true;
        await window.handleAdminApproveUser('budi_ops', 'Budi Wicaksono');
      })()`
    });
    await new Promise(r => setTimeout(r, 2500));

    // Close admin modal and logout
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('btnCloseAdminUsers')?.click();
        document.getElementById('btnLogout')?.click();
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    // STEP 5: budi_ops logs in now that it is approved!
    console.log('--- STEP 5: budi_ops logs in after approval ---');
    const loginSuccessResult = await send('Runtime.evaluate', {
      expression: `(async () => {
        document.getElementById('loginUsername').value = 'budi_ops';
        document.getElementById('loginPassword').value = 'Password123!';
        document.getElementById('formLogin').dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(r => setTimeout(r, 2500));
        return {
          overlayVisible: document.getElementById('loginOverlay')?.style.display !== 'none',
          userFullName: document.getElementById('topbarUserName')?.innerText.trim(),
          userRole: document.getElementById('topbarUserRole')?.innerText.trim()
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Login result after approval:', loginSuccessResult.result.value);

    const shotLoggedIn = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/verify_pic_logged_in_after_approval.png', Buffer.from(shotLoggedIn.data, 'base64'));
    console.log('Saved scratch/verify_pic_logged_in_after_approval.png');

    // STEP 6: Cleanup test account budi_ops
    console.log('--- STEP 6: Cleaning up test account ---');
    await send('Runtime.evaluate', {
      expression: `(async () => {
        if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
          await window.FirebaseManager.deleteUser('budi_ops');
        }
      })()`
    });
    await new Promise(r => setTimeout(r, 1000));
    console.log('Cleaned up budi_ops successfully.');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
