import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-tbl-arrows-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9898;
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
      height: 1280,
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
      `
    });

    console.log('Navigating to http://localhost:8888 ...');
    await send('Page.navigate', { url: 'http://localhost:8888' });
    await new Promise(r => setTimeout(r, 3000));

    // Switch to View 2 (Colocation table)
    console.log('Switching to View 2 (Colocation table) ...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const navBtn = document.querySelector('.nav-item[data-view="view-collo-list"]');
          if (navBtn) navBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Dismiss alert popup if any
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const closeBtns = document.querySelectorAll('.notification-toast-close, [aria-label="Tutup"], button:has(.fa-xmark)');
          closeBtns.forEach(b => b.click());
          const toast = document.querySelector('.notification-toast, #alertExpiredToast');
          if (toast) toast.remove();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 500));

    // Verify pills do NOT exist
    const { result: pillCheck } = await send('Runtime.evaluate', {
      expression: `
        ({
          topPillExists: !!document.getElementById('colloTopScrollPill'),
          btmPillExists: !!document.getElementById('colloBtmScrollPill'),
          leftArrowVisible: document.getElementById('colloScrollArrowLeft')?.classList.contains('visible'),
          rightArrowVisible: document.getElementById('colloScrollArrowRight')?.classList.contains('visible')
        })
      `,
      returnByValue: true
    });
    console.log('Pill & Arrow status before scroll:', pillCheck.value);

    const artifactDir = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';

    const getClip = async (selector) => {
      const { result } = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const el = document.querySelector('${selector}');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          })()
        `,
        returnByValue: true
      });
      return result.value;
    };

    // Capture initial state focused on colloTableCard
    let clip = await getClip('#colloTableCard');
    if (clip) {
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { ...clip, scale: 1 }
      });
      fs.writeFileSync(path.join(artifactDir, 'collo_table_clean_no_pills.png'), Buffer.from(data, 'base64'));
      console.log('Saved collo_table_clean_no_pills.png');
    }

    // Click right arrow on table
    console.log('Clicking right arrow on table ...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const arrow = document.getElementById('colloScrollArrowRight');
          if (arrow) arrow.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    // Check status after scroll
    const { result: afterScrollCheck } = await send('Runtime.evaluate', {
      expression: `
        ({
          scrollLeft: document.getElementById('colloTableScrollWrapper')?.scrollLeft,
          leftArrowVisible: document.getElementById('colloScrollArrowLeft')?.classList.contains('visible'),
          rightArrowVisible: document.getElementById('colloScrollArrowRight')?.classList.contains('visible')
        })
      `,
      returnByValue: true
    });
    console.log('Status after clicking right arrow:', afterScrollCheck.value);

    // Capture state scrolled right focused on colloTableCard
    clip = await getClip('#colloTableCard');
    if (clip) {
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { ...clip, scale: 1 }
      });
      fs.writeFileSync(path.join(artifactDir, 'collo_table_scrolled_right_arrows.png'), Buffer.from(data, 'base64'));
      console.log('Saved collo_table_scrolled_right_arrows.png');
    }

    ws.close();
  } finally {
    edgeProc.kill('SIGKILL');
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    console.log('Done!');
  }
}

main().catch(console.error);
