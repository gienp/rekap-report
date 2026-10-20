const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');
const jsLines = js.split('\n');

const regex = /getElementById\(['"]([^'"]+)['"]\)\.addEventListener/g;
const missing = [];

for (let i = 5969; i < 8450; i++) {
  const line = jsLines[i];
  let match;
  while ((match = regex.exec(line)) !== null) {
    const id = match[1];
    const hasId = html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
    if (!hasId) {
      missing.push({ id, line: i + 1, code: line.trim() });
    }
  }
}

console.log('Total missing elements with .addEventListener (without ?.):', missing.length);
missing.forEach(m => {
  console.log(`Line ${m.line}: id="${m.id}" -> ${m.code}`);
});
