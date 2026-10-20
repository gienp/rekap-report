import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-fin-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9835;
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
      width: 1440,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Navigate to local server
    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 2500));

    // Log in as admin
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const u = document.getElementById('loginUsername');
          const p = document.getElementById('loginPassword');
          const b = document.getElementById('btnLoginSubmit');
          if (u && p && b) {
            u.value = 'admin';
            p.value = 'admin123';
            b.click();
          }
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Switch to View 2: Daftar Link & Finansial
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const navBtn = document.querySelector('[data-view="view-collo-list"]');
          if (navBtn) navBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Inspect presence of button vs visibility of financial cards
    const domCheck = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const btn = document.getElementById('btnToggleColloFinSummary');
          const card = document.getElementById('colloFinSummaryCard');
          const rev = document.getElementById('colloSumRev')?.textContent;
          const otc = document.getElementById('colloSumOtc')?.textContent;
          const deposit = document.getElementById('colloSumDeposit')?.textContent;
          const biaya = document.getElementById('colloSumBiaya')?.textContent;
          const margin = document.getElementById('colloSumMargin')?.textContent;
          const cardComputedStyle = card ? window.getComputedStyle(card).display : 'none';
          const cardHasHiddenClass = card ? card.classList.contains('hidden') : true;

          return {
            hasToggleButton: !!btn,
            cardExists: !!card,
            cardComputedDisplay: cardComputedStyle,
            cardHasHiddenClass,
            rev, otc, deposit, biaya, margin
          };
        })()
      `
    });

    console.log('DOM Check Results:', JSON.stringify(domCheck.result.value, null, 2));

    // Capture screenshot of View 2
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const artifactDir = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';
    const outPath = path.join(artifactDir, 'collo_fin_cards_always_visible.png');
    fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
    console.log('Saved screenshot:', outPath);

    ws.close();
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    try {
      edgeProc.kill('SIGKILL');
    } catch (e) {}
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

main();
