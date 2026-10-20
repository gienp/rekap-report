import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');

// Find view-sitac-pa, view-gangguan, view-efisiensi, view-pic-matrix, view-webgis
const views = ['view-sitac-pa', 'view-gangguan', 'view-efisiensi', 'view-pic-matrix', 'view-webgis'];
for (const v of views) {
  const regex = new RegExp(`id=["']${v}["'][\\s\\S]*?(?=id=["']view-|<!--\\s*MODAL)`, 'i');
  const match = html.match(regex);
  if (match) {
    const text = match[0];
    const colloMatches = [...text.matchAll(/(?:collo|colocation|sewa\s+link)/gi)];
    console.log(`View ${v}: ${colloMatches.length} matches`);
    colloMatches.forEach(m => {
      console.log('  ->', text.substring(Math.max(0, m.index - 30), Math.min(text.length, m.index + 50)).replace(/\s+/g, ' '));
    });
  }
}
