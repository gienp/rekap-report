const fs = require('fs');
const d = JSON.parse(fs.readFileSync('sitac_collo_data.json', 'utf8'));
const collo = d.collo_records || [];

const groups = {};
collo.forEach(c => {
  const p = (c.pengelola || '').trim().toLowerCase();
  const pel = (c.pelanggan || '').trim().toLowerCase();
  const so = (c.no_so || c.sid || '').trim().toLowerCase();
  const term = (c.terminating || '').trim().toLowerCase();
  const key = p + ' || ' + pel + ' || ' + so + ' || ' + term;
  if (!groups[key]) groups[key] = [];
  groups[key].push(c);
});

const activeMulti = Object.entries(groups).filter(([k, list]) => list.filter(c => c.status === 'ACTIVE').length > 1);
console.log('Total groups with >1 ACTIVE records:', activeMulti.length);

activeMulti.forEach(([k, list], i) => {
  console.log('Group ' + (i + 1) + ': ' + k.slice(0, 80));
  list.forEach(c => {
    console.log('  ID ' + c.id + ': ' + c.status + ' | ' + c.start_date + ' to ' + c.end_date + ' | PO: ' + c.po_baru + ' | SPP: ' + c.spp + ' | Rev: ' + c.rev_sewa_tahun + ' | Biaya: ' + c.biaya_sewa_tahun);
  });
});
