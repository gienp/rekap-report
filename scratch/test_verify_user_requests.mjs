import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-both-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9615;

  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1400,900',
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

    const ev = async s => {
      const r = await send('Runtime.evaluate', { expression: s, returnByValue: true });
      return r.result?.value;
    };

    await send('Page.enable');
    await send('Runtime.enable');

    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        localStorage.setItem('telecom_portal_user', JSON.stringify({username:'admin',role:'admin'}));
      `
    });

    console.log('Navigating to portal...');
    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 3000));

    // 1. VERIFY REVENUE SHARING TABLE (PERCENTAGE WITHOUT DECIMALS)
    console.log('Navigating to view-collo-rev-sharing...');
    await ev(`document.querySelector('[data-view="view-collo-rev-sharing"]')?.click()`);
    await new Promise(r => setTimeout(r, 2000));

    const revSharePcts = await ev(`
      (() => {
        const rows = Array.from(document.querySelectorAll('#revShareSummaryTableBody tr'));
        return rows.map(r => {
          const cells = Array.from(r.querySelectorAll('td'));
          return {
            mitra: cells[1]?.textContent.trim(),
            avgPct: cells[3]?.textContent.trim()
          };
        }).slice(0, 10);
      })()
    `);
    console.log('Rev Sharing Top 10 Percentages:', revSharePcts);

    // Capture screenshot of Rev Sharing Table
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    const artifactDir = 'C:\\Users\\anggi\\.gemini\\antigravity-ide\\brain\\e05d1ede-d3ec-46bd-b263-9f3ba08cffea';
    fs.writeFileSync(path.join(artifactDir, 'rev_sharing_percentages_no_comma.png'), Buffer.from(shot.data, 'base64'));
    console.log('Saved rev_sharing_percentages_no_comma.png');

    // 2. VERIFY SITAC PA 2024 DATA
    console.log('Navigating to view-sitac-pa...');
    await ev(`document.querySelector('[data-view="view-sitac-pa"]')?.click()`);
    await new Promise(r => setTimeout(r, 2000));

    // Select 2024 filter
    await ev(`
      (() => {
        const select = document.getElementById('sitacFilterYear');
        if (select) {
          select.value = '2024';
          select.dispatchEvent(new Event('change'));
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));

    const sitac2024Info = await ev(`
      (() => {
        const pageInfo = document.getElementById('sitacPaginationInfo')?.textContent;
        const rows = Array.from(document.querySelectorAll('#sitacTableBody tr'));
        const samples = rows.slice(0, 5).map(r => {
          const cells = Array.from(r.querySelectorAll('td'));
          return {
            no: cells[0]?.textContent.trim(),
            noPa: cells[1]?.textContent.trim(),
            pelanggan: cells[2]?.textContent.trim(),
            pic: cells[3]?.textContent.trim(),
            status: cells[8]?.textContent.trim(),
            date: cells[10]?.textContent.trim()
          };
        });
        return { pageInfo, totalRenderedRows: rows.length, samples };
      })()
    `);
    console.log('SITAC 2024 Info:', JSON.stringify(sitac2024Info, null, 2));

    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'sitac_2024_table_verified.png'), Buffer.from(shot.data, 'base64'));
    console.log('Saved sitac_2024_table_verified.png');

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edgeProc.kill();
  }
}

main();
