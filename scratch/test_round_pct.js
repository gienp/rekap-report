function roundPct(val) {
  if (val === undefined || val === null || val === '') return 0;
  // Strip % or spaces if present
  const clean = String(val).replace(/%/g, '').trim();
  const num = Number(clean);
  if (isNaN(num)) return 0;
  const pct = (Math.abs(num) <= 1 && num !== 0) ? num * 100 : num;
  return Math.round(pct);
}

console.log('19.3% ->', roundPct('19.3%'));
console.log('19.3 ->', roundPct('19.3'));
console.log('0.19342 ->', roundPct(0.19342));
console.log('33.1% ->', roundPct('33.1%'));
console.log('20.1% ->', roundPct('20.1%'));
