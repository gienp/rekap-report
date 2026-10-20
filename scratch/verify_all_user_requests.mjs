import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

async function run() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9599;

  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1536,920',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const r = await fetch(`http://localhost:${cdpPort}/json`);
    const tabs = await r.json();
    const pageTab = tabs.find(t => t.type === 'page');

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
      const res = await send('Runtime.evaluate', { expression, returnByValue: true });
      if (res.exceptionDetails) {
        console.error('Eval exception:', res.exceptionDetails);
      }
      return res.result?.value;
    }

    await send('Runtime.enable');
    await send('Page.enable');

    console.log('Navigating to http://localhost:8888 ...');
    await send('Page.navigate', { url: 'http://localhost:8888' });
    await new Promise(res => setTimeout(res, 3500));

    // Login as Admin
    await evaluate(`
      (() => {
        localStorage.setItem('telecom_portal_user', JSON.stringify({
          username: 'admin',
          full_name: 'Administrator (Manajemen)',
          role: 'admin',
          avatar_icon: 'fa-shield-halved',
          badge_color: 'cyan',
          pic_code: ''
        }));
      })()
    `);
    await send('Page.reload');
    await new Promise(res => setTimeout(res, 3500));

    console.log('\n=== 1. VERIFY PENGELOLA DROPDOWN DEDUPLICATION ===');
    // Switch to view-collo-list
    await evaluate(`
      (() => {
        document.querySelector('[data-view="view-collo-list"]')?.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1200));

    const pengelolaTest = await evaluate(`
      (() => {
        const select = document.getElementById('colloFilterPengelola');
        if (!select) return { found: false };
        const options = Array.from(select.options).map(o => o.text);
        const biznetOptions = options.filter(o => o.toLowerCase().includes('bizn'));
        const counts = {};
        options.forEach(o => counts[o] = (counts[o] || 0) + 1);
        const duplicates = Object.entries(counts).filter(([k, v]) => v > 1).map(([k, v]) => k);

        return {
          found: true,
          totalOptions: options.length,
          biznetOptions,
          duplicates,
          sampleOptions: options.slice(0, 15)
        };
      })()
    `);
    console.log('Pengelola test result:', JSON.stringify(pengelolaTest, null, 2));

    console.log('\n=== 2. VERIFY DISCREPANCY RECORD A821103000308-2 IN SITAC TABLE ===');
    // Switch to SITAC view
    await evaluate(`
      (() => {
        document.querySelector('[data-view="view-sitac-pa"]')?.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1200));

    // Search for A821103000308-2
    await evaluate(`
      (() => {
        const sInp = document.getElementById('sitacSearchInput');
        if (sInp) {
          sInp.value = 'A821103000308-2';
          sInp.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 1200));

    const paTest = await evaluate(`
      (() => {
        const tbody = document.getElementById('sitacTableBody');
        if (!tbody) return { found: false };
        const rows = Array.from(tbody.querySelectorAll('tr')).map(tr => {
          return Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
        });
        return {
          found: true,
          rowCount: rows.length,
          rows
        };
      })()
    `);
    console.log('PA A821103000308-2 test result:', JSON.stringify(paTest, null, 2));

    console.log('\n=== 3. VERIFY REGIONAL SITAC FILTER TABS & KPI CARDS ===');
    // Clear search input
    await evaluate(`
      (() => {
        const sInp = document.getElementById('sitacSearchInput');
        if (sInp) {
          sInp.value = '';
          sInp.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    // Test regional tabs
    const regionsToTest = ['ALL', 'JAKPUSEL', 'JAKUTIM', 'BODEBEK', 'JAKBAR', 'BANTEN', 'TANGERANG'];
    const regionalResults = {};

    for (const reg of regionsToTest) {
      await evaluate(`
        (() => {
          document.querySelector('#sitacRegionTabs [data-region="${reg}"]')?.click();
        })()
      `);
      await new Promise(r => setTimeout(r, 800));

      const stats = await evaluate(`
        (() => {
          return {
            totalPa: document.getElementById('regKpiTotalPa')?.textContent,
            berbiaya: document.getElementById('regKpiBerbiaya')?.textContent,
            zeroCost: document.getElementById('regKpiZeroCost')?.textContent,
            biayaAwal: document.getElementById('regKpiBiayaAwal')?.textContent,
            biayaFinal: document.getElementById('regKpiBiayaFinal')?.textContent,
            hematRupiah: document.getElementById('regKpiHematRupiah')?.textContent,
            hematPersen: document.getElementById('regKpiHematPersen')?.textContent,
            tableRows: document.querySelectorAll('#sitacTableBody tr').length
          };
        })()
      `);
      regionalResults[reg] = stats;
    }
    console.log('Regional results:', JSON.stringify(regionalResults, null, 2));

    console.log('\n=== 4. VERIFY REGIONAL EFFICIENCY MATRIX TABLE IN VIEW-EFISIENSI ===');
    await evaluate(`
      (() => {
        document.querySelector('[data-view="view-efisiensi"]')?.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1200));

    const effMatrix = await evaluate(`
      (() => {
        const tbody = document.getElementById('rekapEfisiensiRegionalTableBody');
        if (!tbody) return { found: false };
        const rows = Array.from(tbody.querySelectorAll('tr')).map(tr => {
          return Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
        });
        return {
          found: true,
          rowCount: rows.length,
          rows
        };
      })()
    `);
    console.log('Efficiency regional matrix:', JSON.stringify(effMatrix, null, 2));

    console.log('\n=== 5. VERIFY PHOTO CANCEL & DELETE FEATURES ===');
    // Switch to SITAC view
    await evaluate(`
      (() => {
        document.querySelector('[data-view="view-sitac-pa"]')?.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 800));

    const quickEditCheck = await evaluate(`
      (() => {
        const qeBtn = document.querySelector('.btn-quick-edit[data-type="sitac"]');
        if (qeBtn) qeBtn.click();
        return {
          modalOpened: document.getElementById('modalQuickEdit')?.style.display === 'flex',
          hasFotoInput: !!document.getElementById('quickEditFotoInput'),
          hasCancelBtn: !!document.getElementById('btnCancelQuickEditFoto'),
          hasDeleteChk: !!document.getElementById('chkDeleteFotoBukti')
        };
      })()
    `);
    console.log('Quick edit modal photo controls:', JSON.stringify(quickEditCheck, null, 2));

    ws.close();
    console.log('\nALL CDP VERIFICATIONS COMPLETE!');
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

run().catch(console.error);
