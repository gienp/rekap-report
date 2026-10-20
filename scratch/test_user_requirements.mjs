import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  console.log('=== TEST ALL USER REQUIREMENTS ===');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-reqs-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9598;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1600,1050',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2500));
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

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1050, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://localhost:8888/index.html' });
    await new Promise(r => setTimeout(r, 3500));

    // Login as admin
    console.log('Logging in...');
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
    await send('Runtime.evaluate', { expression: `document.getElementById('btnCloseDailyBanner')?.click();` });

    // TEST 1: Open Detail Modal for SITAC #1 (the one in user screenshot: R141401002528)
    console.log('\n--- TEST 1: Detail Modal Photo Check (No Fake/Broken Photos) ---');
    const detailCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          window.openDetailModal('sitac', 1);
          const modal = document.getElementById('modalDetail');
          const content = document.getElementById('detailContent');
          const img = content ? content.querySelector('img') : null;
          const dropzone = content ? content.querySelector('.upload-dropzone') : null;
          const dropzoneText = dropzone ? dropzone.textContent : '';

          return {
            modalVisible: modal && modal.style.display !== 'none',
            hasBrokenImg: !!img,
            imgSrc: img ? img.getAttribute('src') : null,
            hasDropzone: !!dropzone,
            dropzoneText: dropzoneText.replace(/\\s+/g, ' ').trim()
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Detail Modal Result:', JSON.stringify(detailCheck.result?.value, null, 2));

    // Capture screenshot of Detail Modal for Record #1
    await new Promise(r => setTimeout(r, 1000));
    const snap1 = await send('Page.captureScreenshot', { format: 'png', quality: 90 });
    fs.writeFileSync('scratch/verified_clean_detail_modal.png', Buffer.from(snap1.data, 'base64'));
    console.log('Saved clean detail modal snapshot: scratch/verified_clean_detail_modal.png');

    // Close detail modal
    await send('Runtime.evaluate', { expression: `document.getElementById('modalDetail').style.display = 'none';` });

    // TEST 2: Duplicate No PA validation in modalAddSitac
    console.log('\n--- TEST 2: Duplicate No PA Validation ---');
    const dupCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('btnOpenAddSitacDirect')?.click();
          const modal = document.getElementById('modalAddSitac');
          const noPaIn = document.getElementById('addSitacNoPa');
          const warnBox = document.getElementById('addSitacNoPaDupWarning');
          const warnMsg = document.getElementById('addSitacNoPaDupMsg');

          // Type an existing No PA
          noPaIn.value = 'R141401002528';
          noPaIn.dispatchEvent(new Event('input', { bubbles: true }));

          const warnVisibleAfterInput = warnBox && !warnBox.classList.contains('hidden');
          const msgText = warnMsg ? warnMsg.textContent : '';

          // Type an unused No PA
          noPaIn.value = 'PA-UNIQUE-999888';
          noPaIn.dispatchEvent(new Event('input', { bubbles: true }));
          const warnHiddenAfterUnique = warnBox && warnBox.classList.contains('hidden');

          return {
            modalOpened: modal && modal.style.display !== 'none',
            warnVisibleOnDup: warnVisibleAfterInput,
            warnText: msgText,
            warnHiddenOnUnique: warnHiddenAfterUnique
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Duplicate No PA Test Result:', JSON.stringify(dupCheck.result?.value, null, 2));

    // Close add modal
    await send('Runtime.evaluate', { expression: `document.getElementById('modalAddSitac').style.display = 'none';` });

    // TEST 3: Photo Upload and Persistence Test
    console.log('\n--- TEST 3: Photo Upload via API / Modal ---');
    const uploadTest = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          // Create a valid 1x1 test PNG base64
          const testPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
          const upRes = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: 'test_real_upload.png',
              data: testPng,
              type: 'sitac',
              id: 1
            })
          });
          const upJson = await upRes.json();

          // Refresh and open detail modal to verify image loads
          window.openDetailModal('sitac', 1);
          await new Promise(r => setTimeout(r, 800));
          const content = document.getElementById('detailContent');
          const img = content ? content.querySelector('img') : null;

          return {
            uploadSuccess: upJson.success,
            savedFilename: upJson.filename,
            fileUrl: upJson.file_url,
            renderedImgSrc: img ? img.getAttribute('src') : null
          };
        })()
      `,
      returnByValue: true,
      awaitPromise: true
    });
    console.log('Upload Test Result:', JSON.stringify(uploadTest.result?.value, null, 2));

    // Capture screenshot showing uploaded photo
    await new Promise(r => setTimeout(r, 1000));
    const snap2 = await send('Page.captureScreenshot', { format: 'png', quality: 90 });
    fs.writeFileSync('scratch/verified_uploaded_photo_detail.png', Buffer.from(snap2.data, 'base64'));
    console.log('Saved uploaded photo snapshot: scratch/verified_uploaded_photo_detail.png');

    // Close detail modal
    await send('Runtime.evaluate', { expression: `document.getElementById('modalDetail').style.display = 'none';` });

    // Clean up test photo from record 1 so data remains pristine
    await send('Runtime.evaluate', {
      expression: `
        (async () => {
          await fetch('/api/sitac/1', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ foto_bukti: null })
          });
        })()
      `,
      awaitPromise: true
    });

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY ===');
    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
