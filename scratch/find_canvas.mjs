import fs from 'fs';

const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');
let currentView = 'root';
lines.forEach((l, idx) => {
  if (l.includes('id="view-')) {
    const match = l.match(/id="(view-[^"]+)"/);
    if (match) currentView = match[1];
  }
  if (l.includes('<canvas')) {
    console.log(`${currentView} (Line ${idx + 1}): ${l.trim()}`);
  }
});
