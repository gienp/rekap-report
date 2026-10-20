import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-pick-add-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9877;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Navigating to http://localhost:8888 ...');
    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 2500));

    // Log in as lapangan (or admin)
    console.log('Logging in as lapangan user harlan...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('loginUsername').value = 'harlan';
          document.getElementById('loginPassword').value = 'password123';
          document.getElementById('btnLoginSubmit')?.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Open Pick Add modal
    console.log('Triggering modalPickAddType...');
    const modalCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pickModal = document.getElementById('modalPickAddType');
          if (pickModal) pickModal.style.display = 'flex';
          const btnGangguan = document.getElementById('btnPickGangguan');
          const btnSitac = document.getElementById('btnPickSitac');
          const btnCollo = document.getElementById('btnPickCollo');
          return {
            modalVisible: pickModal?.style.display !== 'none',
            hasGangguan: !!btnGangguan,
            hasSitac: !!btnSitac,
            hasCollo: !!btnCollo
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Modal check result:', modalCheck.result.value);

    // Capture screenshot
    await new Promise(r => setTimeout(r, 500));
    const snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'modal_pick_add_verified.png'), Buffer.from(snap.data, 'base64'));
    console.log('Captured scratch/modal_pick_add_verified.png');

    // Test clicking SITAC option opens modalAddSitac
    const sitacOpen = await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('btnPickSitac')?.click();
          const pickDisplay = document.getElementById('modalPickAddType')?.style.display;
          const sitacDisplay = document.getElementById('modalAddSitac')?.style.display;
          return { pickDisplay, sitacDisplay };
        })()
      `,
      returnByValue: true
    });
    console.log('SITAC Click Result:', sitacOpen.result.value);

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
