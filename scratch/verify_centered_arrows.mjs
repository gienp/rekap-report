import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-centered-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9899;
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

    let id = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const msgId = id++;
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === msgId) {
          ws.removeEventListener('message', handler);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    });

    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        localStorage.setItem('telecom_portal_user', JSON.stringify({
          id: 1,
          username: 'admin',
          full_name: 'Administrator (Manajemen)',
          role: 'admin',
          email: 'admin@telecom.co.id'
        }));
        const style = document.createElement('style');
        style.textContent = '.notification-toast, #alertExpiredToast, #dailyContractAlertBanner { display: none !important; }';
        document.head ? document.head.appendChild(style) : document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
      `
    });

    console.log('Navigating to http://localhost:8888 ...');
    await send('Page.navigate', { url: 'http://localhost:8888' });
    await new Promise(r => setTimeout(r, 3000));

    // Dismiss any toasts completely and prevent new ones
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.querySelectorAll('.notification-toast, #alertExpiredToast').forEach(el => el.remove());
          if (window.dismissAlertToast) window.dismissAlertToast();
        })()
      `
    });

    const artifactDir = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';

    // 1. TEST SITAC PA TABLE (from user screenshot)
    console.log('Switching to SITAC PA view (view-sitac-pa) ...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const navBtn = document.querySelector('.nav-item[data-view="view-sitac-pa"]');
          if (navBtn) navBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Remove toast again after switching view
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.querySelectorAll('.notification-toast, #alertExpiredToast').forEach(el => el.remove());
        })()
      `
    });
    await new Promise(r => setTimeout(r, 200));

    const { result: sitacMetrics } = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = document.getElementById('sitacTableCard');
          const wrapper = document.getElementById('sitacTableScrollWrapper');
          const arrow = document.getElementById('sitacScrollArrowRight');
          if (!card || !wrapper || !arrow) return null;
          const cardR = card.getBoundingClientRect();
          const wrapR = wrapper.getBoundingClientRect();
          const arrR = arrow.getBoundingClientRect();
          const arrowMidY = arrR.top + arrR.height / 2;
          const wrapMidY = wrapR.top + wrapR.height / 2;
          const diffPx = arrowMidY - wrapMidY;
          return {
            cardHeight: cardR.height,
            wrapperTopRelCard: wrapR.top - cardR.top,
            wrapperHeight: wrapR.height,
            arrowTopRelCard: arrR.top - cardR.top,
            arrowMidY,
            wrapMidY,
            diffPx,
            isCentered: Math.abs(diffPx) < 2,
            arrowVisible: arrow.classList.contains('visible')
          };
        })()
      `,
      returnByValue: true
    });
    console.log('SITAC Table Arrow Metrics:', sitacMetrics.value);

    // Capture SITAC card screenshot
    const { result: sitacClip } = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = document.getElementById('sitacTableCard');
          if (!card) return null;
          const r = card.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        })()
      `,
      returnByValue: true
    });
    if (sitacClip.value) {
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { ...sitacClip.value, scale: 1 }
      });
      fs.writeFileSync(path.join(artifactDir, 'sitac_table_arrows_centered.png'), Buffer.from(data, 'base64'));
      console.log('Saved sitac_table_arrows_centered.png');
    }

    // 2. TEST COLOCATION TABLE
    console.log('Switching to Colocation table view (view-collo-list) ...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const navBtn = document.querySelector('.nav-item[data-view="view-collo-list"]');
          if (navBtn) navBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.querySelectorAll('.notification-toast, #alertExpiredToast').forEach(el => el.remove());
        })()
      `
    });
    await new Promise(r => setTimeout(r, 200));

    const { result: colloMetrics } = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = document.getElementById('colloTableCard');
          const wrapper = document.getElementById('colloTableScrollWrapper');
          const arrow = document.getElementById('colloScrollArrowRight');
          if (!card || !wrapper || !arrow) return null;
          const cardR = card.getBoundingClientRect();
          const wrapR = wrapper.getBoundingClientRect();
          const arrR = arrow.getBoundingClientRect();
          const arrowMidY = arrR.top + arrR.height / 2;
          const wrapMidY = wrapR.top + wrapR.height / 2;
          const diffPx = arrowMidY - wrapMidY;
          return {
            cardHeight: cardR.height,
            wrapperTopRelCard: wrapR.top - cardR.top,
            wrapperHeight: wrapR.height,
            arrowTopRelCard: arrR.top - cardR.top,
            arrowMidY,
            wrapMidY,
            diffPx,
            isCentered: Math.abs(diffPx) < 2,
            arrowVisible: arrow.classList.contains('visible')
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Colocation Table Arrow Metrics:', colloMetrics.value);

    const { result: colloClip } = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = document.getElementById('colloTableCard');
          if (!card) return null;
          const r = card.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        })()
      `,
      returnByValue: true
    });
    if (colloClip.value) {
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { ...colloClip.value, scale: 1 }
      });
      fs.writeFileSync(path.join(artifactDir, 'collo_table_arrows_centered.png'), Buffer.from(data, 'base64'));
      console.log('Saved collo_table_arrows_centered.png');
    }

    ws.close();
  } finally {
    edgeProc.kill('SIGKILL');
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    console.log('Done!');
  }
}

main().catch(console.error);
