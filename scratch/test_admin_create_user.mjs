import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-create-admin-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9820;
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
    const filePath = path.join(process.cwd(), 'index.html').replace(/\\/g, '/');
    await send('Page.navigate', { url: `file:///${filePath}` });
    await new Promise(r => setTimeout(r, 2500));

    // 1. Log in as admin
    console.log('1. Logging in as admin...');
    const loginRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          document.getElementById('loginUsername').value = 'admin';
          document.getElementById('loginPassword').value = 'admin123';
          const submitBtn = document.getElementById('btnLoginSubmit');
          submitBtn.click();
          await new Promise(r => setTimeout(r, 1500));
          return {
            overlayHidden: document.getElementById('loginOverlay')?.classList.contains('hidden') || document.getElementById('loginOverlay')?.style.display === 'none',
            currentUser: window.state?.currentUser?.username
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Admin login result:', loginRes.result.value);

    // 2. Open Kelola Akun Modal
    console.log('2. Opening Kelola Akun modal...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.getElementById('btnOpenAdminUsers');
          if (btn) btn.click();
          else {
            const m = document.getElementById('modalAdminUsers');
            if (m) m.style.display = 'flex';
          }
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    // 3. Switch to 'Tambah Akun' tab
    console.log('3. Switching to Tambah Akun tab...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          window.switchAdminTab('create');
        })()
      `
    });
    await new Promise(r => setTimeout(r, 800));

    // Screenshot modal 'Tambah Akun' tab
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    const snapModal = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'verify_modal_tambah_admin.png'), Buffer.from(snapModal.data, 'base64'));
    console.log('Saved screenshot to scratch/verify_modal_tambah_admin.png');

    // 4. Fill form to create new Admin 'test_admin_satria'
    console.log('4. Submitting form to create new Admin user...');
    const createRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          document.getElementById('adminCreateUsername').value = 'test_admin_satria';
          document.getElementById('adminCreateDisplayName').value = 'Satria Wicaksana';
          document.getElementById('adminCreateRole').value = 'admin';
          document.getElementById('adminCreateTeamRole').value = 'Administrator Operasional';
          document.getElementById('adminCreateEmail').value = 'satria@telecom.ops';
          document.getElementById('adminCreatePassword').value = 'adminpass123';
          document.getElementById('adminCreateConfirmPassword').value = 'adminpass123';
          document.getElementById('adminCreateAdminPw').value = 'admin123';

          const form = document.getElementById('formAdminCreateUser');
          const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
          form.dispatchEvent(submitEvent);

          await new Promise(r => setTimeout(r, 2500));
          return {
            alertText: document.getElementById('adminCreateAlert')?.textContent.trim(),
            alertClass: document.getElementById('adminCreateAlert')?.className
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Create Admin Result:', createRes.result.value);

    // 5. Check if test_admin_satria appears in Reset Password dropdown
    const checkDropdown = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const select = document.getElementById('adminResetTargetUser');
          const options = Array.from(select?.options || []).map(o => o.text);
          return options.find(t => t.includes('test_admin_satria'));
        })()
      `,
      returnByValue: true
    });
    console.log('Found in dropdown:', checkDropdown.result.value);

    // 6. Test Logging in with newly created Admin account!
    console.log('6. Logging out admin and logging in as new admin test_admin_satria...');
    const newLoginRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          // Close modal
          const modal = document.getElementById('modalAdminUsers');
          if (modal) modal.style.display = 'none';

          // Logout
          const overlay = document.getElementById('loginOverlay');
          if (overlay) {
            overlay.style.display = 'flex';
            overlay.classList.remove('hidden');
          }
          if (window.switchLoginPane) window.switchLoginPane('login');

          // Login as test_admin_satria
          document.getElementById('loginUsername').value = 'test_admin_satria';
          document.getElementById('loginPassword').value = 'adminpass123';
          document.getElementById('btnLoginSubmit').click();

          await new Promise(r => setTimeout(r, 2500));

          return {
            overlayHidden: document.getElementById('loginOverlay')?.classList.contains('hidden') || document.getElementById('loginOverlay')?.style.display === 'none',
            user: window.state?.currentUser?.username,
            role: window.state?.currentUser?.role,
            fullName: window.state?.currentUser?.full_name
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('New Admin Login verification:', newLoginRes.result.value);

    // Screenshot after login
    const snapLoggedIn = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'verify_new_admin_logged_in.png'), Buffer.from(snapLoggedIn.data, 'base64'));
    console.log('Saved screenshot to scratch/verify_new_admin_logged_in.png');

    // 7. Cleanup: Delete test_admin_satria
    console.log('7. Cleaning up test account test_admin_satria...');
    const cleanupRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
            const db = window.FirebaseManager.getDb();
            const snap = await db.collection('users').where('username', '==', 'test_admin_satria').get();
            for (const doc of snap.docs) {
              await doc.ref.delete();
            }
            return { cleaned: snap.size };
          }
          return { cleaned: 0 };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Cleanup result:', cleanupRes.result.value);

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
