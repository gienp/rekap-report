const fs = require('fs');
const s = fs.readFileSync('app.js', 'utf8');
s.split('\n').forEach((l, i) => {
  if (l.includes("addEventListener('click'") || l.includes('addEventListener("click"')) {
    console.log(`${i + 1}: ${l.trim()}`);
  }
});
