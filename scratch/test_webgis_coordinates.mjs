import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  console.log('=== VERIFYING WEBGIS COORDINATES, STATUS COLORS & DYNAMIC PIN CREATION ===');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-webgis-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9595;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1600,1050',
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

    await send('Page.enable');
    console.log('Navigating to http://localhost:8888/index.html ...');
    await send('Page.navigate', { url: 'http://localhost:8888/index.html' });
    await new Promise(r => setTimeout(r, 3500));

    // 1. Perform Admin Login
    console.log('Logging in as admin...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const userIn = document.getElementById('loginUsername');
          const passIn = document.getElementById('loginPassword');
          const submitBtn = document.getElementById('btnLoginSubmit');
          if (userIn && passIn && submitBtn) {
            userIn.value = 'admin';
            passIn.value = 'admin123';
            submitBtn.click();
          }
        })()
      `
    });

    await new Promise(r => setTimeout(r, 2000));

    // 2. Dismiss any modal/banner and switch to view-webgis
    console.log('Navigating to view-webgis...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const closeDaily = document.getElementById('btnCloseDailyBanner');
          if (closeDaily) closeDaily.click();

          const btn = document.querySelector('button[data-view="view-webgis"]');
          if (btn) btn.click();
        })()
      `
    });

    await new Promise(r => setTimeout(r, 3000));

    // 3. Inspect Map State and Markers
    console.log('Inspecting Leaflet Map and rendered pins...');
    const mapEval = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pinCountEl = document.getElementById('mapPinCount');
          const circles = Array.from(document.querySelectorAll('#portalLeafletMap svg path.leaflet-interactive'));
          const fillColors = circles.map(c => c.getAttribute('fill'));
          
          const colorDistribution = fillColors.reduce((acc, col) => {
            acc[col] = (acc[col] || 0) + 1;
            return acc;
          }, {});

          return {
            pinCountText: pinCountEl ? pinCountEl.textContent.trim() : null,
            totalSvgPinsRendered: circles.length,
            colorDistribution
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Initial Map Data:\n', JSON.stringify(mapEval.result?.value, null, 2));

    // 4. Test Filter Buttons (Finish, Cancel, ALL)
    console.log('\nTesting status filter button clicks:');
    
    // Filter Finish
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('.map-tag-btn[data-status="Finish"]');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1200));

    const finishEval = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pinCountEl = document.getElementById('mapPinCount');
          const circles = Array.from(document.querySelectorAll('#portalLeafletMap svg path.leaflet-interactive'));
          return {
            pinCountText: pinCountEl ? pinCountEl.textContent.trim() : null,
            totalPinsRendered: circles.length,
            colors: circles.map(c => c.getAttribute('fill')).slice(0, 5)
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Filtered by Finish:', JSON.stringify(finishEval.result?.value));

    // Filter Cancel
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('.map-tag-btn[data-status="Cancel"]');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1200));

    const cancelEval = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pinCountEl = document.getElementById('mapPinCount');
          const circles = Array.from(document.querySelectorAll('#portalLeafletMap svg path.leaflet-interactive'));
          return {
            pinCountText: pinCountEl ? pinCountEl.textContent.trim() : null,
            totalPinsRendered: circles.length,
            colors: circles.map(c => c.getAttribute('fill')).slice(0, 5)
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Filtered by Cancel:', JSON.stringify(cancelEval.result?.value));

    // Reset to ALL
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('.map-tag-btn[data-status="ALL"]');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1200));

    // 5. Test Clicking a Pin to verify popup contents (Google Maps link and Detail button)
    console.log('\nTesting Marker Popup click...');
    const popupEval = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const firstCircle = document.querySelector('#portalLeafletMap svg path.leaflet-interactive');
          if (firstCircle) {
            firstCircle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          }
          const popup = document.querySelector('.leaflet-popup-content');
          const gmapsLink = popup ? popup.querySelector('a[href*="google.com/maps"]') : null;
          const detailBtn = popup ? popup.querySelector('button[onclick*="openDetailModal"]') : null;

          return {
            popupOpened: !!popup,
            hasGmapsLink: !!gmapsLink,
            gmapsUrl: gmapsLink ? gmapsLink.getAttribute('href') : null,
            hasDetailBtn: !!detailBtn
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Popup Verification:', JSON.stringify(popupEval.result?.value, null, 2));

    // 6. Test Quick Edit Modal for SITAC (GPS input and paste test)
    console.log('\nTesting Quick Edit Modal GPS input parsing...');
    const quickEditEval = await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (typeof window.openQuickEditModal === 'function') {
            window.openQuickEditModal('sitac', 36);
            const modal = document.getElementById('modalQuickEdit');
            const latIn = document.getElementById('quickEditSitacLat');
            const lngIn = document.getElementById('quickEditSitacLng');
            const gpsBtn = document.getElementById('btnGetGpsQuickEditSitac');

            // Test parsing a pasted Google Maps URL
            const testUrl = 'https://www.google.com/maps?q=-6.211544,106.844321';
            latIn.value = '';
            lngIn.value = '';
            // Simulate paste event
            const pasteEvt = new Event('paste', { bubbles: true });
            pasteEvt.clipboardData = { getData: () => testUrl };
            latIn.dispatchEvent(pasteEvt);

            return {
              modalVisible: modal && modal.style.display !== 'none',
              hasGpsBtn: !!gpsBtn,
              extractedLat: latIn.value,
              extractedLng: lngIn.value,
              parseSuccess: latIn.value === '-6.211544' && lngIn.value === '106.844321'
            };
          }
          return { error: 'openQuickEditModal not found' };
        })()
      `,
      returnByValue: true
    });
    console.log('Quick Edit Modal GPS Parsing Test:', JSON.stringify(quickEditEval.result?.value, null, 2));

    // Close Quick Edit Modal
    await send('Runtime.evaluate', {
      expression: `document.getElementById('modalQuickEdit').style.display = 'none';`
    });

    // 7. Focus on map bounds & capture screenshot
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const fitBtn = document.getElementById('btnFitMapBounds');
          if (fitBtn) fitBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    const screenshot = await send('Page.captureScreenshot', { format: 'png', quality: 90 });
    const screenshotPath = path.resolve('scratch/test_webgis_coordinates_verified.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`\n✓ Full WebGIS Verification Screenshot saved: ${screenshotPath}`);

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
