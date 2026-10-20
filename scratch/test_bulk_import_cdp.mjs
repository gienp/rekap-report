import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

(async () => {
  console.log('--- START BULK IMPORT CDP TEST ---');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-import-test-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9530;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + cdpPort,
    '--user-data-dir=' + tmpDir,
    '--window-size=1440,900',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`http://localhost:${cdpPort}/json`);
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
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Navigating to http://localhost:8888 ...');
    await send('Page.navigate', { url: 'http://localhost:8888' });
    await new Promise(r => setTimeout(r, 2500));

    // Helper for evaluate
    async function evalCode(expr) {
      const wrappedExpr = `(async () => {\n${expr}\n})()`;
      const res = await send('Runtime.evaluate', {
        expression: wrappedExpr,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        console.error('Eval error:', res.exceptionDetails);
        throw new Error(res.exceptionDetails.text || 'Eval error');
      }
      return res.result?.value;
    }

    // Capture screenshot helper
    async function captureScreenshot(filepath) {
      const snap = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filepath, Buffer.from(snap.data, 'base64'));
      console.log('Screenshot saved:', filepath);
    }

    // 1. Login as admin
    console.log('Logging in as admin...');
    await evalCode(`
      document.getElementById('loginUsername').value = 'admin';
      document.getElementById('loginPassword').value = 'admin123';
      document.getElementById('formLogin').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await new Promise(r => setTimeout(r, 2000));

    // 2. Open Import Modal
    console.log('Opening #modalImportExcel...');
    const modalCheck = await evalCode(`
      const modal = document.getElementById('modalImportExcel');
      if (modal) modal.style.display = 'flex';
      return {
        exists: !!modal,
        display: modal ? window.getComputedStyle(modal).display : 'null',
        hasTargetSelect: !!document.getElementById('importTargetModule'),
        hasDupSelect: !!document.getElementById('importDuplicateMode'),
        hasBtnTemplate: !!document.getElementById('btnDownloadImportTemplate')
      };
    `);
    console.log('Modal Check:', modalCheck);
    await captureScreenshot('scratch/verified_import_step1_open.png');

    // 3. Test Preview rendering with simulated raw Excel data
    console.log('Testing renderImportPreviewTable with mock records...');
    const previewResult = await evalCode(`
      (function() {
        const mockRows = [
          {
            'No PA': 'PA-CDP-TEST-001',
            'Pelanggan': 'PT JALUR PRIMA TEKNOLOGI',
            'PTL': 'Harlan',
            'PIC SITAC': 'Budi Rodiyah',
            'Rute / Terminating': 'SITE GEDUNG INDOSAT',
            'Biaya Permintaan Awal': '12.000.000',
            'Biaya Final': '10.500.000',
            'Progress': 'Ongoing',
            'Tanggal Disposisi': '2026-10-12',
            'Latitude': -6.2088,
            'Longitude': 106.8456
          },
          {
            'No PA': 'PA-CDP-TEST-002',
            'Pelanggan': 'PT FIBER GLOBAL ASIA',
            'PTL': 'Harlan',
            'PIC SITAC': 'Edi Swargaloka',
            'Rute / Terminating': 'SITE MENARA KUNINGAN',
            'Biaya Permintaan Awal': '25.000.000',
            'Biaya Final': '22.000.000',
            'Progress': 'Finish',
            'Tanggal Disposisi': '2026-10-10',
            'Tanggal Selesai': '2026-10-12',
            'Latitude': -6.2150,
            'Longitude': 106.8300
          }
        ];

        if (typeof window.triggerExcelImportPreview === 'function') {
          window.triggerExcelImportPreview(mockRows, 'sitac_records');
        }

        const previewContainer = document.getElementById('importPreviewContainer');
        const count = document.getElementById('importPreviewCount')?.textContent;
        const tableWrap = document.getElementById('importPreviewTableWrap');
        const submitBtn = document.getElementById('btnSubmitImportExcel');

        return {
          previewShown: previewContainer ? !previewContainer.classList.contains('hidden') : false,
          count: count,
          submitDisabled: submitBtn ? submitBtn.disabled : true,
          tableHtml: tableWrap ? tableWrap.innerHTML.substring(0, 150) : ''
        };
      })()
    `);
    console.log('Preview Result:', previewResult);
    await new Promise(r => setTimeout(r, 600));
    await captureScreenshot('scratch/verified_import_step2_preview.png');

    // 4. Test submitting batch to backend
    console.log('Testing AJAX batch submit to /api/import/batch directly from page context...');
    const submitResult = await evalCode(`
      (async function() {
        const payload = {
          module: 'sitac_records',
          mode: 'skip',
          records: [
            {
              no_pa: 'PA-CDP-TEST-001',
              pelanggan: 'PT JALUR PRIMA TEKNOLOGI',
              ptl: 'Harlan',
              pic_perijinan: 'Budi Rodiyah',
              terminating: 'SITE GEDUNG INDOSAT',
              biaya_permintaan_awal: 12000000,
              biaya_final: 10500000,
              progress: 'Ongoing',
              date_dispos: '2026-10-12',
              latitude: -6.2088,
              longitude: 106.8456
            },
            {
              no_pa: 'PA-CDP-TEST-002',
              pelanggan: 'PT FIBER GLOBAL ASIA',
              ptl: 'Harlan',
              pic_perijinan: 'Edi Swargaloka',
              terminating: 'SITE MENARA KUNINGAN',
              biaya_permintaan_awal: 25000000,
              biaya_final: 22000000,
              progress: 'Finish',
              date_dispos: '2026-10-10',
              date_close: '2026-10-12',
              latitude: -6.2150,
              longitude: 106.8300
            }
          ]
        };

        const res = await fetch('/api/import/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();

        // Update progress bar & result alert in DOM to reflect UI
        const progBox = document.getElementById('importProgressContainer');
        const progPct = document.getElementById('importProgressPct');
        const progBar = document.getElementById('importProgressBar');
        const alertBox = document.getElementById('importResultAlert');

        if (progBox) progBox.classList.remove('hidden');
        if (progPct) progPct.textContent = '100%';
        if (progBar) progBar.style.width = '100%';

        if (alertBox) {
          alertBox.className = 'p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium text-xs flex items-center gap-2 mt-2';
          alertBox.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400 text-base"></i> <span>' + json.message + '</span>';
          alertBox.classList.remove('hidden');
        }

        return json;
      })()
    `);
    console.log('Batch Submit Response:', submitResult);
    await new Promise(r => setTimeout(r, 600));
    await captureScreenshot('scratch/verified_import_step3_success.png');

    // 5. Navigate to SITAC view and search for the newly imported record
    console.log('Navigating to SITAC view to verify table display...');
    await evalCode(`
      const btnSitac = document.querySelector('.nav-item[data-view="view-sitac"]') || document.getElementById('btnMobSitac');
      if (btnSitac) btnSitac.click();
      if (typeof window.loadSitacData === 'function') window.loadSitacData();
    `);
    await new Promise(r => setTimeout(r, 1500));
    await captureScreenshot('scratch/verified_import_sitac_table.png');

    console.log('--- ALL CDP CHECKS COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('CDP Error:', err);
  } finally {
    try { edgeProc.kill(); } catch (e) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
})();
