import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-notif-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9600;
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
      width: 1600,
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Navigating to live Firebase URL (unauthenticated / login page)...');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    
    // Wait 5 seconds to ensure any timer / setTimeout would have fired if bug was present
    await new Promise(r => setTimeout(r, 5000));

    // Check notification visibility on login page
    const loginNotifState = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const banner = document.getElementById('dailyContractAlertBanner');
          const bell = document.getElementById('contractAlertBellContainer');
          const isBannerHidden = banner ? banner.classList.contains('opacity-0') : true;
          const isBellHidden = bell ? (bell.style.display === 'none' || window.getComputedStyle(bell).display === 'none') : true;
          return {
            isBannerHidden,
            bannerClasses: banner ? banner.className : '',
            bellDisplay: bell ? bell.style.display : '',
            isBellHidden
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Login Page Notification Status:', loginNotifState.result?.value);

    // Capture screenshot on login page
    const snapLogin = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(process.cwd(), 'scratch', 'live_login_no_notifications.png'),
      Buffer.from(snapLogin.data, 'base64')
    );
    console.log('Screenshot saved: scratch/live_login_no_notifications.png');

    // Now log in as admin to ensure admin STILL gets notifications
    console.log('Now logging in as admin...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('loginUsername').value = 'admin';
          document.getElementById('loginPassword').value = 'admin123';
          document.getElementById('btnLoginSubmit').click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 3000));

    const adminNotifState = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const banner = document.getElementById('dailyContractAlertBanner');
          const bell = document.getElementById('contractAlertBellContainer');
          return {
            bellDisplay: bell ? bell.style.display : '',
            isBellVisible: bell ? (window.getComputedStyle(bell).display !== 'none') : false,
            bannerClasses: banner ? banner.className : ''
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Admin Logged In Notification Status:', adminNotifState.result?.value);

    const snapAdmin = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(process.cwd(), 'scratch', 'live_admin_notifications_active.png'),
      Buffer.from(snapAdmin.data, 'base64')
    );
    console.log('Screenshot saved: scratch/live_admin_notifications_active.png');

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
