const fs = require('fs');
const js = fs.readFileSync('app.js', 'utf8');
const lines = js.split('\n');

const nonCallbackLines = [];
let depth = 0;

for (let i = 5969; i < 8380; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;

  // Track function depth
  // In setupEventListeners (depth = 1):
  // Statements directly in setupEventListeners are at depth 1.
  for (let c of line) {
    if (c === '{') depth++;
    if (c === '}') depth--;
  }

  // If at depth 1 (directly in setupEventListeners)
  if (depth === 1) {
    nonCallbackLines.push({ lineNum: i + 1, code: trimmed });
  }
}

console.log('Total statements directly in setupEventListeners before line 8380:', nonCallbackLines.length);
nonCallbackLines.forEach(l => {
  // Check if it's doing something other than getElementById or setting up listeners
  console.log(`L${l.lineNum}: ${l.code}`);
});
