import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

async function testAllRealViews() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-all-views-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9587;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=' + cdpPort,
    '--user-data-dir=' + tmpDir,
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://localhost:' + cdpPort + '/json');
    const tabs = await res.json();
    const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
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

    await send('Runtime.enable');
    await send('Page.enable');

    const testUrl = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');
    await send('Page.navigate', { url: testUrl });
    await new Promise(r => setTimeout(r, 2500));

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
    await new Promise(r => setTimeout(r, 1500));

    const realViews = [
      'view-executive',
      'view-collo-list',
      'view-collo-rev-sharing',
      'view-collo-alerts',
      'view-sitac-pa',
      'view-sitac-colleagues',
      'view-efisiensi',
      'view-pic-matrix',
      'view-webgis'
    ];

    let passedCount = 0;

    for (const viewId of realViews) {
      console.log(`\nTesting view persistence: ${viewId}`);

      // Switch view
      await send('Runtime.evaluate', {
        expression: `
          (() => {
            const btn = document.querySelector('.nav-item[data-view="${viewId}"]');
            if (btn) btn.click();
            else if (typeof switchView === 'function') switchView('${viewId}');
          })()
        `
      });
      await new Promise(r => setTimeout(r, 800));

      // Trigger F5 / Refresh
      console.log(`Reloading tab (F5)...`);
      await send('Page.reload');
      await new Promise(r => setTimeout(r, 2500));

      // Verify active view after reload
      const res = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const activeElem = document.querySelector('.portal-view.active');
            const savedLS = localStorage.getItem('telecom_portal_active_view');
            const hash = window.location.hash;
            return {
              activeId: activeElem ? activeElem.id : null,
              savedLS,
              hash
            };
          })()
        `,
        returnByValue: true
      });

      const { activeId, savedLS, hash } = res.result.value;
      console.log(`Result: activeId=${activeId}, savedLS=${savedLS}, hash=${hash}`);

      if (activeId === viewId) {
        console.log(`✅ PASSED: Tab refreshed and successfully remained on ${viewId}!`);
        passedCount++;
      } else {
        console.error(`❌ FAILED: Expected ${viewId}, got ${activeId}`);
      }
    }

    console.log(`\nSummary: ${passedCount} / ${realViews.length} views passed!`);
    if (passedCount === realViews.length) {
      console.log('ALL REAL PORTAL VIEWS PASSED TAB REFRESH PERSISTENCE TEST!');
    } else {
      process.exitCode = 1;
    }

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

testAllRealViews();
