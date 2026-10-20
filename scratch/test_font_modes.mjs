import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-font-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9825;
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
    const filePath = path.join(process.cwd(), 'index.html').replace(/\\/g, '/');
    await send('Page.navigate', { url: `file:///${filePath}` });
    await new Promise(r => setTimeout(r, 2000));

    // Log in as admin
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('loginUsername').value = 'admin';
          document.getElementById('loginPassword').value = 'admin123';
          document.getElementById('btnLoginSubmit').click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Measure fonts in Dark Mode
    const darkFonts = await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.documentElement.removeAttribute('data-theme');
          const getFont = (sel) => {
            const el = document.querySelector(sel);
            return el ? window.getComputedStyle(el).fontFamily : 'not found';
          };
          return {
            body: getFont('body'),
            bentoBigValue: getFont('.bento-big-value'),
            kpiValue: getFont('.kpi-value'),
            pbiVisualTitle: getFont('.pbi-visual-title'),
            breadcrumbPageTitle: getFont('#breadcrumbPageTitle'),
            h1: getFont('h1')
          };
        })()
      `,
      returnByValue: true
    });
    console.log('=== DARK MODE FONTS ===\n', darkFonts.result.value);

    // Measure fonts in Light Mode
    const lightFonts = await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.documentElement.setAttribute('data-theme', 'light');
          const getFont = (sel) => {
            const el = document.querySelector(sel);
            return el ? window.getComputedStyle(el).fontFamily : 'not found';
          };
          return {
            body: getFont('body'),
            bentoBigValue: getFont('.bento-big-value'),
            kpiValue: getFont('.kpi-value'),
            pbiVisualTitle: getFont('.pbi-visual-title'),
            breadcrumbPageTitle: getFont('#breadcrumbPageTitle'),
            h1: getFont('h1')
          };
        })()
      `,
      returnByValue: true
    });
    console.log('=== LIGHT MODE FONTS ===\n', lightFonts.result.value);

    // Take screenshot of both
    await send('Runtime.evaluate', { expression: `document.documentElement.removeAttribute('data-theme');` });
    await new Promise(r => setTimeout(r, 400));
    const snapDark = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'font_compare_dark.png'), Buffer.from(snapDark.data, 'base64'));

    await send('Runtime.evaluate', { expression: `document.documentElement.setAttribute('data-theme', 'light');` });
    await new Promise(r => setTimeout(r, 400));
    const snapLight = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'font_compare_light.png'), Buffer.from(snapLight.data, 'base64'));

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
