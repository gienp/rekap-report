import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-final-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9892;
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
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
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
        localStorage.setItem('portal_theme', 'dark');
      `
    });

    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 3000));

    // Switch to View 2
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('button[data-view="view-collo-list"], a[data-view="view-collo-list"]');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Dismiss any modal/reminder if present
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btnLater = document.getElementById('btnRemindLaterContract');
          if (btnLater) btnLater.click();
          const banner = document.getElementById('dailyContractAlertBanner');
          if (banner) banner.style.display = 'none';
        })()
      `
    });
    await new Promise(r => setTimeout(r, 500));

    // Scroll window down to focus on table
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          window.scrollTo({ top: 380, behavior: 'instant' });
        })()
      `
    });
    await new Promise(r => setTimeout(r, 500));

    // Check elements
    const check1 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = document.getElementById('colloTableCard');
          const wrapper = document.getElementById('colloTableScrollWrapper');
          const leftBtn = document.getElementById('colloScrollArrowLeft');
          const rightBtn = document.getElementById('colloScrollArrowRight');
          const topPill = document.getElementById('colloTopScrollPill');
          const btmPill = document.getElementById('colloBtmScrollPill');

          return {
            hasCard: !!card,
            hasWrapper: !!wrapper,
            hasLeftBtn: !!leftBtn,
            hasRightBtn: !!rightBtn,
            hasTopPill: !!topPill,
            hasBtmPill: !!btmPill,
            scrollLeft: wrapper ? wrapper.scrollLeft : null,
            maxScroll: wrapper ? wrapper.scrollWidth - wrapper.clientWidth : null,
            leftVisible: leftBtn ? leftBtn.classList.contains('visible') : false,
            rightVisible: rightBtn ? rightBtn.classList.contains('visible') : false
          };
        })()
      `,
      returnByValue: true
    });
    console.log('INITIAL CHECK (LEFT):', JSON.stringify(check1.result.value, null, 2));

    // Take screenshot 1 (table at left)
    const snap1 = await send('Page.captureScreenshot', { format: 'png' });
    const out1 = path.join(process.cwd(), 'scratch', 'table_scroll_left_verified.png');
    fs.writeFileSync(out1, Buffer.from(snap1.data, 'base64'));

    // Click right arrow!
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const rightBtn = document.getElementById('colloScrollArrowRight');
          if (rightBtn) rightBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 800));

    // Click right arrow again to scroll further
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const rightBtn = document.getElementById('colloScrollArrowRight');
          if (rightBtn) rightBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 800));

    // Check state after scroll
    const check2 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const wrapper = document.getElementById('colloTableScrollWrapper');
          const leftBtn = document.getElementById('colloScrollArrowLeft');
          const rightBtn = document.getElementById('colloScrollArrowRight');

          return {
            scrollLeft: wrapper ? wrapper.scrollLeft : null,
            maxScroll: wrapper ? wrapper.scrollWidth - wrapper.clientWidth : null,
            leftVisible: leftBtn ? leftBtn.classList.contains('visible') : false,
            rightVisible: rightBtn ? rightBtn.classList.contains('visible') : false
          };
        })()
      `,
      returnByValue: true
    });
    console.log('AFTER SCROLL RIGHT:', JSON.stringify(check2.result.value, null, 2));

    // Take screenshot 2 (table scrolled right, showing deposit & margin columns)
    const snap2 = await send('Page.captureScreenshot', { format: 'png' });
    const out2 = path.join(process.cwd(), 'scratch', 'table_scroll_right_verified.png');
    fs.writeFileSync(out2, Buffer.from(snap2.data, 'base64'));

    // Copy to artifact directory
    const artifactDir = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';
    fs.copyFileSync(out1, path.join(artifactDir, 'table_scroll_left_verified.png'));
    fs.copyFileSync(out2, path.join(artifactDir, 'table_scroll_right_verified.png'));
    console.log('Artifacts copied successfully!');

    ws.close();
  } finally {
    try { edgeProc.kill(); } catch (e) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
