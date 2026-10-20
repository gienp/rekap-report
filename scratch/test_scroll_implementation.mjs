import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-scr-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9889;
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
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
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
        localStorage.setItem('portal_theme', 'dark');
      `
    });

    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 3000));

    // Switch to View 2 (Daftar Link & Finansial)
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('button[data-view="view-collo-list"], a[data-view="view-collo-list"]');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Inject prototype CSS & elements to test layout
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const style = document.createElement('style');
          style.id = 'proto-scroll-style';
          style.textContent = \`
            .table-container-card {
              position: relative !important;
            }
            .table-scroll-arrow {
              position: absolute;
              top: 50%;
              transform: translateY(-50%);
              width: 44px;
              height: 44px;
              border-radius: 50%;
              background: rgba(14, 30, 27, 0.92);
              backdrop-filter: blur(16px);
              -webkit-backdrop-filter: blur(16px);
              border: 1.5px solid rgba(42, 157, 143, 0.5);
              color: #2dd4bf;
              box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.6), 0 0 16px rgba(42, 157, 143, 0.35);
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              z-index: 35;
              transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
              opacity: 0;
              pointer-events: none;
              font-size: 1rem;
            }
            .table-scroll-arrow.visible {
              opacity: 1;
              pointer-events: auto;
            }
            .table-scroll-arrow:hover {
              background: rgba(42, 157, 143, 0.95);
              color: #ffffff;
              border-color: #5eead4;
              transform: translateY(-50%) scale(1.12);
              box-shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.7), 0 0 24px rgba(42, 157, 143, 0.6);
            }
            .table-scroll-arrow.left {
              left: 12px;
            }
            .table-scroll-arrow.right {
              right: 12px;
            }
            .table-scroll-pill {
              display: inline-flex;
              align-items: center;
              gap: 0.35rem;
              padding: 0.25rem 0.5rem;
              border-radius: 8px;
              background: rgba(14, 30, 27, 0.75);
              border: 1px solid rgba(42, 157, 143, 0.25);
              font-size: 0.75rem;
            }
            .btn-scroll-nav {
              display: inline-flex;
              align-items: center;
              gap: 0.35rem;
              padding: 0.25rem 0.65rem;
              border-radius: 6px;
              font-size: 0.72rem;
              font-weight: 600;
              background: rgba(255, 255, 255, 0.05);
              border: 1px solid rgba(255, 255, 255, 0.1);
              color: #94a3b8;
              cursor: pointer;
              transition: all 0.18s ease;
            }
            .btn-scroll-nav:hover {
              background: rgba(42, 157, 143, 0.2);
              border-color: rgba(42, 157, 143, 0.5);
              color: #2dd4bf;
            }
            .btn-scroll-nav.accent {
              background: rgba(42, 157, 143, 0.2);
              border-color: rgba(42, 157, 143, 0.45);
              color: #2dd4bf;
            }
            .btn-scroll-nav.accent:hover {
              background: rgba(42, 157, 143, 0.35);
              border-color: #2dd4bf;
              color: #ffffff;
            }
          \`;
          document.head.appendChild(style);

          // Add floating arrows inside table container card
          const card = document.querySelector('#view-collo-list .table-container-card');
          const wrapper = card.querySelector('.overflow-x-auto');
          
          const leftBtn = document.createElement('button');
          leftBtn.className = 'table-scroll-arrow left';
          leftBtn.innerHTML = '<i class=\"fa-solid fa-chevron-left\"></i>';
          leftBtn.title = 'Geser tabel ke kiri';

          const rightBtn = document.createElement('button');
          rightBtn.className = 'table-scroll-arrow right visible';
          rightBtn.innerHTML = '<i class=\"fa-solid fa-chevron-right\"></i>';
          rightBtn.title = 'Geser tabel ke kanan';

          card.appendChild(leftBtn);
          card.appendChild(rightBtn);

          // Update visibility on scroll
          function updateBtns() {
            const sl = wrapper.scrollLeft;
            const max = wrapper.scrollWidth - wrapper.clientWidth;
            if (sl > 10) leftBtn.classList.add('visible');
            else leftBtn.classList.remove('visible');

            if (sl < max - 10) rightBtn.classList.add('visible');
            else rightBtn.classList.remove('visible');
          }
          wrapper.addEventListener('scroll', updateBtns);
          updateBtns();

          leftBtn.onclick = () => wrapper.scrollBy({ left: -400, behavior: 'smooth' });
          rightBtn.onclick = () => wrapper.scrollBy({ left: 400, behavior: 'smooth' });

          // Also add pill in pagination bar
          const pag = card.querySelector('.table-pagination');
          if (pag) {
            const pill = document.createElement('div');
            pill.className = 'table-scroll-pill';
            pill.innerHTML = \`
              <span class="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 mr-1">
                <i class="fa-solid fa-arrows-left-right text-teal-400"></i> Geser Tabel:
              </span>
              <button type="button" class="btn-scroll-nav" id="testPagLeft">
                <i class="fa-solid fa-arrow-left"></i> Kiri
              </button>
              <button type="button" class="btn-scroll-nav accent" id="testPagRight">
                Kanan <i class="fa-solid fa-arrow-right"></i>
              </button>
            \`;
            pag.insertBefore(pill, pag.children[1] || null);
            document.getElementById('testPagLeft').onclick = () => wrapper.scrollBy({ left: -400, behavior: 'smooth' });
            document.getElementById('testPagRight').onclick = () => wrapper.scrollBy({ left: 400, behavior: 'smooth' });
          }
        })()
      `
    });

    await new Promise(r => setTimeout(r, 1000));

    // Capture initial screenshot (at left)
    const snap1 = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 240, y: 350, width: 1180, height: 500, scale: 1 }
    });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'scroll_test_left.png'), Buffer.from(snap1.data, 'base64'));
    console.log('Saved scroll_test_left.png');

    // Click right scroll button!
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('.table-scroll-arrow.right');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 800));

    // Click right scroll button again to scroll further!
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('.table-scroll-arrow.right');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 800));

    // Check scroll position
    const scrollPos = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const wrapper = document.querySelector('#view-collo-list .table-container-card .overflow-x-auto');
          return {
            scrollLeft: wrapper.scrollLeft,
            maxScroll: wrapper.scrollWidth - wrapper.clientWidth,
            leftVisible: document.querySelector('.table-scroll-arrow.left').classList.contains('visible'),
            rightVisible: document.querySelector('.table-scroll-arrow.right').classList.contains('visible')
          };
        })()
      `,
      returnByValue: true
    });
    console.log('AFTER SCROLL RIGHT:', JSON.stringify(scrollPos.result.value, null, 2));

    // Capture screenshot at right
    const snap2 = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 240, y: 350, width: 1180, height: 500, scale: 1 }
    });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'scroll_test_right.png'), Buffer.from(snap2.data, 'base64'));
    console.log('Saved scroll_test_right.png');

    ws.close();
  } finally {
    try { edgeProc.kill(); } catch (e) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
