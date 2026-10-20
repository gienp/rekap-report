import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-pic-notif-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9588;

  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1536,920',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`http://localhost:${port}/json`);
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page');
    if (!pageTab) throw new Error('Could not find blank page tab');

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

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
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (res.exceptionDetails) {
        console.error('Eval error:', res.exceptionDetails);
      }
      return res.result?.value;
    }

    await send('Runtime.enable');
    await send('Page.enable');

    console.log('Navigating to live Firebase URL: https://analytics-811fc.web.app ...');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 3000));

    // Reset session
    await evaluate(`
      localStorage.clear();
      location.reload();
    `);
    await new Promise(r => setTimeout(r, 3000));

    // TEST 1: Login as PIC Harlan
    console.log('--- TEST 1: PIC HARLAN LOGIN & NOTIFICATIONS ---');
    await evaluate(`
      document.getElementById('loginUsername').value = 'harlan';
      document.getElementById('loginPassword').value = 'pic123';
      document.getElementById('btnLoginSubmit').click();
    `);

    // Wait for login to complete
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 100));
      const overlayHidden = await evaluate(`document.getElementById('loginOverlay')?.style.display === 'none'`);
      if (overlayHidden) break;
    }

    await new Promise(r => setTimeout(r, 1500));

    const harlanCheck = await evaluate(`
      (() => {
        const banner = document.getElementById('dailyContractAlertBanner');
        const bannerVisible = banner && !banner.classList.contains('opacity-0') && !banner.classList.contains('pointer-events-none');
        const bellContainer = document.getElementById('contractAlertBellContainer');
        const bellBtn = document.getElementById('btnContractAlertBell');
        const bellBadge = document.getElementById('contractAlertBellBadge');
        const groupCollo = document.getElementById('groupCollo');

        return {
          role: window.state?.currentUser?.role,
          picCode: window.state?.currentUser?.pic_code,
          activeTechnician: window.state?.activeTechnician,
          dailyContractAlertBannerVisible: bannerVisible,
          contractAlertBellContainerDisplay: bellContainer?.style?.display,
          groupColloDisplay: groupCollo?.style?.display,
          bellTitle: bellBtn?.title,
          bellBadgeText: bellBadge?.textContent,
          bellBadgeHidden: bellBadge?.classList.contains('hidden')
        };
      })()
    `);
    console.log('PIC Harlan State:', JSON.stringify(harlanCheck, null, 2));

    // Open notification panel as Harlan
    await evaluate(`document.getElementById('btnContractAlertBell')?.click();`);
    await new Promise(r => setTimeout(r, 800));

    const harlanPanelCheck = await evaluate(`
      (() => {
        const panel = document.getElementById('contractAlertNotificationPanel');
        const panelHidden = panel?.classList.contains('hidden');
        const panelTitle = document.getElementById('panelTitleText')?.textContent;
        const panelSubtitle = document.getElementById('panelSubtitleText')?.textContent;
        const badgeCount = document.getElementById('panelAlertBadgeCount')?.textContent;
        const footerInfo = document.getElementById('panelFooterInfo')?.textContent?.trim();
        const goToText = document.getElementById('panelGoToText')?.textContent?.trim();
        const tabs = Array.from(document.querySelectorAll('#alertPanelTabs .alert-panel-tab')).map(t => t.textContent.trim());
        const itemCount = document.querySelectorAll('#alertNotificationList .alert-panel-item').length;
        const firstItem = document.querySelector('#alertNotificationList .alert-panel-item')?.textContent?.trim()?.replace(/\\s+/g, ' ');

        return {
          panelHidden,
          panelTitle,
          panelSubtitle,
          badgeCount,
          footerInfo,
          goToText,
          tabs,
          itemCount,
          firstItemPreview: firstItem ? firstItem.slice(0, 150) : null
        };
      })()
    `);
    console.log('PIC Harlan Notification Panel:', JSON.stringify(harlanPanelCheck, null, 2));

    // Capture screenshot of Harlan's notification panel
    const snapHarlan = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/live_pic_harlan_notifications.png', Buffer.from(snapHarlan.data, 'base64'));
    console.log('Saved scratch/live_pic_harlan_notifications.png');

    // TEST 2: Logout and Login as Admin
    console.log('\n--- TEST 2: ADMIN LOGIN & CONTRACT ALERT BANNER ---');
    await evaluate(`
      document.getElementById('btnLogout')?.click();
    `);
    await new Promise(r => setTimeout(r, 1500));

    await evaluate(`
      document.getElementById('loginUsername').value = 'admin';
      document.getElementById('loginPassword').value = 'admin123';
      document.getElementById('btnLoginSubmit').click();
    `);

    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 100));
      const overlayHidden = await evaluate(`document.getElementById('loginOverlay')?.style.display === 'none'`);
      if (overlayHidden) break;
    }

    await new Promise(r => setTimeout(r, 2000));

    const adminCheck = await evaluate(`
      (() => {
        const banner = document.getElementById('dailyContractAlertBanner');
        const bannerVisible = banner && !banner.classList.contains('opacity-0') && !banner.classList.contains('pointer-events-none');
        const bellBtn = document.getElementById('btnContractAlertBell');
        const bellBadge = document.getElementById('contractAlertBellBadge');
        const groupCollo = document.getElementById('groupCollo');

        return {
          role: window.state?.currentUser?.role,
          dailyContractAlertBannerVisible: bannerVisible,
          bannerCount: document.getElementById('dailyBannerCount')?.textContent,
          groupColloDisplay: groupCollo?.style?.display,
          bellTitle: bellBtn?.title,
          bellBadgeText: bellBadge?.textContent,
          bellBadgeHidden: bellBadge?.classList.contains('hidden')
        };
      })()
    `);
    console.log('Admin State:', JSON.stringify(adminCheck, null, 2));

    // Open notification panel as Admin
    await evaluate(`document.getElementById('btnContractAlertBell')?.click();`);
    await new Promise(r => setTimeout(r, 800));

    const adminPanelCheck = await evaluate(`
      (() => {
        const panelTitle = document.getElementById('panelTitleText')?.textContent;
        const panelSubtitle = document.getElementById('panelSubtitleText')?.textContent;
        const badgeCount = document.getElementById('panelAlertBadgeCount')?.textContent;
        const tabs = Array.from(document.querySelectorAll('#alertPanelTabs .alert-panel-tab')).map(t => t.textContent.trim());
        const itemCount = document.querySelectorAll('#alertNotificationList .alert-panel-item').length;

        return {
          panelTitle,
          panelSubtitle,
          badgeCount,
          tabs,
          itemCount
        };
      })()
    `);
    console.log('Admin Notification Panel:', JSON.stringify(adminPanelCheck, null, 2));

    const snapAdmin = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/live_admin_contract_alerts.png', Buffer.from(snapAdmin.data, 'base64'));
    console.log('Saved scratch/live_admin_contract_alerts.png');

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edgeProc.kill('SIGKILL');
  }
}

main();
