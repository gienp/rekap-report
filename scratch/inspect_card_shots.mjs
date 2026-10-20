import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function inspectCard() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-card-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9597;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + tmpDir,
    '--window-size=1600,1200',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://localhost:' + port + '/json');
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

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: 'https://analytics-811fc.web.app' });
    await new Promise(r => setTimeout(r, 3000));

    // Login
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('loginUsername').value = 'admin';
        document.getElementById('loginPassword').value = 'admin123';
        document.getElementById('btnLoginSubmit').click();
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    // Switch to rev sharing
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.nav-item[data-view="view-collo-rev-sharing"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 1500));

    // Get bounding box of chart card
    const box1 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = document.getElementById('chartRevShareMitra')?.closest('.pbi-visual-card');
          const r = card.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        })()
      `,
      returnByValue: true
    });
    console.log('RevShare Mitra Card Box:', box1.result?.value);

    const clip1 = box1.result?.value;
    if (clip1 && clip1.width > 0) {
      const shot = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: clip1.x, y: clip1.y, width: clip1.width, height: clip1.height, scale: 1 }
      });
      fs.writeFileSync('scratch/card_rev_share_mitra.png', Buffer.from(shot.data, 'base64'));
    }

    // Compare card
    const box2 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = document.getElementById('chartRevShareCompare')?.closest('.pbi-visual-card');
          const r = card.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        })()
      `,
      returnByValue: true
    });
    const clip2 = box2.result?.value;
    if (clip2 && clip2.width > 0) {
      const shot = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: clip2.x, y: clip2.y, width: clip2.width, height: clip2.height, scale: 1 }
      });
      fs.writeFileSync('scratch/card_rev_share_compare.png', Buffer.from(shot.data, 'base64'));
    }

    // Switch to alerts
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.nav-item[data-view="view-collo-alerts"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 1500));

    // Alerts Donut card
    const box3 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = document.getElementById('chartAlertsCategoryDonut')?.closest('.pbi-visual-card');
          const r = card.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        })()
      `,
      returnByValue: true
    });
    const clip3 = box3.result?.value;
    if (clip3 && clip3.width > 0) {
      const shot = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: clip3.x, y: clip3.y, width: clip3.width, height: clip3.height, scale: 1 }
      });
      fs.writeFileSync('scratch/card_alerts_donut.png', Buffer.from(shot.data, 'base64'));
    }

    // Alerts Bar card
    const box4 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = document.getElementById('chartAlertsSisaHari')?.closest('.pbi-visual-card');
          const r = card.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        })()
      `,
      returnByValue: true
    });
    const clip4 = box4.result?.value;
    if (clip4 && clip4.width > 0) {
      const shot = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: clip4.x, y: clip4.y, width: clip4.width, height: clip4.height, scale: 1 }
      });
      fs.writeFileSync('scratch/card_alerts_bar.png', Buffer.from(shot.data, 'base64'));
    }

    console.log('All 4 cards captured directly!');
  } finally {
    edgeProc.kill('SIGKILL');
  }
}

inspectCard().catch(console.error);
