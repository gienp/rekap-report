import fs from 'fs';
import path from 'path';

const home = process.env.USERPROFILE || process.env.HOME;
const p = path.join(home, '.config', 'configstore', 'firebase-tools.json');
const token = JSON.parse(fs.readFileSync(p, 'utf8')).tokens?.access_token;

async function checkCollections() {
  const base = 'https://firestore.googleapis.com/v1/projects/analytics-811fc/databases/default/documents';
  const cols = ['summary', 'users', 'rekap_efisiensi', 'sitac_records', 'gangguan_records', 'collo_records'];
  
  for (const c of cols) {
    const res = await fetch(`${base}/${c}?pageSize=3`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    console.log(`Collection '${c}':`, data.documents ? `✓ Exists (${data.documents.length}+ docs), sample doc: ${data.documents[0]?.name?.split('/').pop()}` : 'Empty/Not found');
  }
}
checkCollections().catch(console.error);
