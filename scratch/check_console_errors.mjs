import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

const port = 4901;
const cdpPort = 9591;

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(process.cwd(), reqPath.slice(1));
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    let ct = 'text/plain';
    if (filePath.endsWith('.html')) ct = 'text/html';
    else if (filePath.endsWith('.js')) ct = 'application/javascript';
    else if (filePath.endsWith('.css')) ct = 'text/css';
    else if (filePath.endsWith('.json')) ct = 'application/json';
    res.writeHead(200, { 'Content-Type': ct });
    return res.end(fs.readFileSync(filePath));
  }
  res.writeHead(404);
  res.end('Not found');
});

server.listen(port, async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-err-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tmpDir}`,
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1200));

  try {
    const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    const pages = await listRes.json();
    const wsUrl = pages[0].webSocketDebuggerUrl;

    const WebSocketClass = globalThis.WebSocket;
    const ws = new WebSocketClass(wsUrl);

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    function send(method, params = {}) {
      const id = msgId++;
      return new Promise((resolve) => {
        const handler = (evt) => {
          const parsed = JSON.parse(evt.data);
          if (parsed.id === id) {
            ws.removeEventListener('message', handler);
            resolve(parsed.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    const consoleLogs = [];
    const jsExceptions = [];

    ws.addEventListener('message', (evt) => {
      const parsed = JSON.parse(evt.data);
      if (parsed.method === 'Runtime.consoleAPICalled') {
        const text = (parsed.params.args || []).map(a => a.value || a.description || JSON.stringify(a)).join(' ');
        consoleLogs.push(`[${parsed.params.type}] ${text}`);
      }
      if (parsed.method === 'Runtime.exceptionThrown') {
        jsExceptions.push(parsed.params.exceptionDetails);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: `http://localhost:${port}/index.html` });

    await new Promise(r => setTimeout(r, 3000));

    console.log('=== JS EXCEPTIONS ===');
    if (jsExceptions.length === 0) {
      console.log('None! Zero uncaught exceptions.');
    } else {
      jsExceptions.forEach(e => console.log('EXCEPTION:', e.text, e.exception?.description));
    }

    console.log('\n=== CONSOLE LOGS (WARNINGS & ERRORS) ===');
    const errs = consoleLogs.filter(l => l.startsWith('[error]') || l.startsWith('[warning]'));
    if (errs.length === 0) {
      console.log('No console errors or warnings recorded!');
    } else {
      errs.forEach(l => console.log(l));
    }

    ws.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});
