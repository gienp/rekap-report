import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-dyn-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9891;
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

    // Switch to View 2
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('button[data-view="view-collo-list"], a[data-view="view-collo-list"]');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Inject dynamic gliding arrow buttons
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const style = document.createElement('style');
          style.textContent = \`
            .table-container-card {
              position: relative !important;
            }
            .table-floating-arrow {
              position: absolute;
              width: 44px;
              height: 44px;
              border-radius: 50%;
              background: rgba(14, 30, 27, 0.94);
              backdrop-filter: blur(16px);
              -webkit-backdrop-filter: blur(16px);
              border: 1.5px solid rgba(42, 157, 143, 0.55);
              color: #2dd4bf;
              box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.6), 0 0 16px rgba(42, 157, 143, 0.35);
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              z-index: 35;
              transition: transform 0.15s ease, background 0.15s ease, opacity 0.2s ease, border-color 0.15s ease;
              font-size: 1.05rem;
              opacity: 0;
              pointer-events: none;
              transform: translateY(-50%);
            }
            .table-floating-arrow.visible {
              opacity: 1;
              pointer-events: auto;
            }
            .table-floating-arrow:hover {
              background: rgba(42, 157, 143, 0.95);
              color: #ffffff;
              border-color: #5eead4;
              transform: translateY(-50%) scale(1.14);
              box-shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.7), 0 0 24px rgba(42, 157, 143, 0.6);
            }
            .table-floating-arrow.left { left: 14px; }
            .table-floating-arrow.right { right: 14px; }

            .table-scroll-pill {
              display: inline-flex;
              align-items: center;
              gap: 0.35rem;
              padding: 0.25rem 0.5rem;
              border-radius: 8px;
              background: rgba(14, 30, 27, 0.85);
              border: 1px solid rgba(42, 157, 143, 0.3);
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

          const card = document.querySelector('#view-collo-list .table-container-card');
          const wrapper = card.querySelector('.overflow-x-auto');

          const btnL = document.createElement('button');
          btnL.className = 'table-floating-arrow left';
          btnL.innerHTML = '<i class=\"fa-solid fa-chevron-left\"></i>';
          btnL.title = 'Geser tabel ke kiri';

          const btnR = document.createElement('button');
          btnR.className = 'table-floating-arrow right';
          btnR.innerHTML = '<i class=\"fa-solid fa-chevron-right\"></i>';
          btnR.title = 'Geser tabel ke kanan';

          card.appendChild(btnL);
          card.appendChild(btnR);

          function updateArrowPos() {
            const cardRect = card.getBoundingClientRect();
            const clampY = Math.max(70, Math.min(cardRect.height - 70, window.innerHeight * 0.5 - cardRect.top));
            btnL.style.top = clampY + 'px';
            btnR.style.top = clampY + 'px';

            const sl = wrapper.scrollLeft;
            const max = wrapper.scrollWidth - wrapper.clientWidth;
            if (sl > 10) btnL.classList.add('visible');
            else btnL.classList.remove('visible');

            if (sl < max - 10) btnR.classList.add('visible');
            else btnR.classList.remove('visible');
          }

          window.addEventListener('scroll', updateArrowPos, { passive: true });
          wrapper.addEventListener('scroll', updateArrowPos, { passive: true });
          updateArrowPos();

          btnL.onclick = () => wrapper.scrollBy({ left: -420, behavior: 'smooth' });
          btnR.onclick = () => wrapper.scrollBy({ left: 420, behavior: 'smooth' });

          // Top pill
          const sumText = document.getElementById('colloTableSummaryText');
          if (sumText && sumText.parentElement) {
            const topPill = document.createElement('div');
            topPill.className = 'table-scroll-pill';
            topPill.innerHTML = \`
              <span class="text-[11px] text-slate-300 font-medium flex items-center gap-1.5 mr-1">
                <i class="fa-solid fa-arrows-left-right text-teal-400"></i> Geser Tabel:
              </span>
              <button type="button" class="btn-scroll-nav" id="dynTopLeft">
                <i class="fa-solid fa-arrow-left"></i> Kiri
              </button>
              <button type="button" class="btn-scroll-nav accent" id="dynTopRight">
                Kanan <i class="fa-solid fa-arrow-right"></i>
              </button>
            \`;
            sumText.parentElement.appendChild(topPill);
            document.getElementById('dynTopLeft').onclick = () => wrapper.scrollBy({ left: -420, behavior: 'smooth' });
            document.getElementById('dynTopRight').onclick = () => wrapper.scrollBy({ left: 420, behavior: 'smooth' });
          }

          // Bottom pill in pagination
          const pag = card.querySelector('.table-pagination');
          if (pag) {
            const btmPill = document.createElement('div');
            btmPill.className = 'table-scroll-pill';
            btmPill.innerHTML = \`
              <span class="text-[11px] text-slate-300 font-medium flex items-center gap-1.5 mr-1">
                <i class="fa-solid fa-arrows-left-right text-teal-400"></i> Geser Kolom:
              </span>
              <button type="button" class="btn-scroll-nav" id="dynBtmLeft">
                <i class="fa-solid fa-arrow-left"></i> Kiri
              </button>
              <button type="button" class="btn-scroll-nav accent" id="dynBtmRight">
                Kanan <i class="fa-solid fa-arrow-right"></i>
              </button>
            \`;
            pag.insertBefore(btmPill, pag.children[1] || null);
            document.getElementById('dynBtmLeft').onclick = () => wrapper.scrollBy({ left: -420, behavior: 'smooth' });
            document.getElementById('dynBtmRight').onclick = () => wrapper.scrollBy({ left: 420, behavior: 'smooth' });
          }
        })()
      `
    });

    await new Promise(r => setTimeout(r, 800));

    // Check arrow rects
    const rectCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const l = document.querySelector('.table-floating-arrow.left');
          const r = document.querySelector('.table-floating-arrow.right');
          return {
            leftRect: l ? l.getBoundingClientRect() : null,
            rightRect: r ? r.getBoundingClientRect() : null,
            rightVisible: r ? r.classList.contains('visible') : false
          };
        })()
      `,
      returnByValue: true
    });
    console.log('ARROW RECTS:', JSON.stringify(rectCheck.result.value, null, 2));

    // Capture screenshot at top position
    const snap1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'dynamic_arrow_top.png'), Buffer.from(snap1.data, 'base64'));

    // Scroll page down to row 10
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          window.scrollTo({ top: 500, behavior: 'instant' });
        })()
      `
    });
    await new Promise(r => setTimeout(r, 500));

    // Click right arrow!
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('.table-floating-arrow.right');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 800));

    const snap2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'dynamic_arrow_scrolled.png'), Buffer.from(snap2.data, 'base64'));

    ws.close();
  } finally {
    try { edgeProc.kill(); } catch (e) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
