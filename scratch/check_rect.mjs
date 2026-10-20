import fs from 'fs';

async function main() {
  const res = await fetch('http://localhost:9890/json').catch(() => null);
  if (!res) {
    console.log('Port 9890 not open');
    return;
  }
  const tabs = await res.json();
  const pageTab = tabs.find(t => t.type === 'page');
  if (!pageTab) return;
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  function send(m, p = {}) {
    return new Promise(r => {
      ws.addEventListener('message', e => {
        const d = JSON.parse(e.data);
        if (d.id === id) r(d.result);
      });
      ws.send(JSON.stringify({ id: id++, method: m, params: p }));
    });
  }

  const r = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const b = document.querySelector('.table-scroll-arrow.right');
        const t = document.querySelector('.table-scroll-track.right');
        const card = document.querySelector('#view-collo-list .table-container-card');
        return {
          btn: b ? b.getBoundingClientRect() : null,
          track: t ? t.getBoundingClientRect() : null,
          card: card ? card.getBoundingClientRect() : null,
          op: b ? window.getComputedStyle(b).opacity : null,
          vis: b ? b.classList.contains('visible') : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('RECTS:', JSON.stringify(r.value, null, 2));
  ws.close();
}

main().catch(console.error);
