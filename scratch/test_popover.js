const fs = require('fs');
const vm = require('vm');

const context = { window: {}, console: console };
vm.createContext(context);
vm.runInContext(fs.readFileSync('sitac_collo_data.js', 'utf8'), context);
const collo = context.window.SITAC_COLLO_DATA.collo_records || [];

const formatSoCell = (sid, noSo) => {
  const rawSid = String(sid || '')
    .split(/[\r\n,]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s !== '-');

  const rawSo = String(noSo || '')
    .split(/[\r\n,]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s !== '-');

  let sidHtml = '';
  if (rawSid.length > 0) {
    const primarySid = rawSid[0];
    const remainingSidCount = rawSid.length - 1;
    if (remainingSidCount > 0) {
      const sidPopoverPayload = encodeURIComponent(JSON.stringify({
        title: `Daftar SID (${rawSid.length} SID)`,
        icon: 'fa-network-wired',
        items: rawSid.map(s => ({ name: s, badge: null }))
      }));
      sidHtml = `<button data-popover="${sidPopoverPayload}">+sid</button>`;
    }
  }

  let soHtml = '';
  if (rawSo.length > 0) {
    const primarySo = rawSo[0];
    const remainingCount = rawSo.length - 1;
    if (remainingCount > 0) {
      const popoverPayload = encodeURIComponent(JSON.stringify({
        title: `Daftar Nomor SO (${rawSo.length} SO)`,
        icon: 'fa-file-lines',
        items: rawSo.map(s => ({ name: s, badge: null }))
      }));
      soHtml = `<button data-popover="${popoverPayload}">+so</button>`;
    }
  }
  return sidHtml + soHtml;
};

let errors = 0;
let soButtonCount = 0;
collo.forEach((c, idx) => {
  const html = formatSoCell(c.sid, c.no_so);
  const regex = /data-popover="([^"]+)"/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    soButtonCount++;
    try {
      JSON.parse(decodeURIComponent(m[1]));
    } catch (e) {
      errors++;
    }
  }
});
console.log('SO/SID Button count:', soButtonCount, 'Errors:', errors);
