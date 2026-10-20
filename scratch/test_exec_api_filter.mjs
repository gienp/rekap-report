import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-filter-test-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9884;
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
    await send('Page.navigate', { url: 'http://localhost:8888/' });
    await new Promise(r => setTimeout(r, 2000));

    // Test API for ALL vs 2024 vs 2025 vs 2026
    const apiTest = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const resAll = await fetch('/api/executive/summary').then(r => r.json());
          const res2024 = await fetch('/api/executive/summary?year=2024').then(r => r.json());
          const res2025 = await fetch('/api/executive/summary?year=2025').then(r => r.json());
          const res2026 = await fetch('/api/executive/summary?year=2026').then(r => r.json());
          return {
            all: {
              colloActive: resAll.collo.active_count,
              sitacTotal: resAll.sitac.total_pa,
              sitacFinish: resAll.sitac.finish_count,
              gangguanTotal: resAll.gangguan.total_gangguan,
              monthlyTrendCount: resAll.monthly_trend.length,
              jenisSewa: resAll.jenis_sewa_dist.map(j => ({ j: j.jenis, cnt: j.cnt }))
            },
            y2024: {
              colloActive: res2024.collo.active_count,
              sitacTotal: res2024.sitac.total_pa,
              sitacFinish: res2024.sitac.finish_count,
              gangguanTotal: res2024.gangguan.total_gangguan,
              monthlyTrendCount: res2024.monthly_trend.length,
              jenisSewa: res2024.jenis_sewa_dist.map(j => ({ j: j.jenis, cnt: j.cnt }))
            },
            y2025: {
              colloActive: res2025.collo.active_count,
              sitacTotal: res2025.sitac.total_pa,
              sitacFinish: res2025.sitac.finish_count,
              gangguanTotal: res2025.gangguan.total_gangguan,
              monthlyTrendCount: res2025.monthly_trend.length,
              jenisSewa: res2025.jenis_sewa_dist.map(j => ({ j: j.jenis, cnt: j.cnt }))
            },
            y2026: {
              colloActive: res2026.collo.active_count,
              sitacTotal: res2026.sitac.total_pa,
              sitacFinish: res2026.sitac.finish_count,
              gangguanTotal: res2026.gangguan.total_gangguan,
              monthlyTrendCount: res2026.monthly_trend.length,
              jenisSewa: res2026.jenis_sewa_dist.map(j => ({ j: j.jenis, cnt: j.cnt }))
            }
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('API Test Comparison:', JSON.stringify(apiTest.result.value, null, 2));

    ws.close();
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(console.error);
