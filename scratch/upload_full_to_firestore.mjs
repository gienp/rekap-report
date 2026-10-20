import fs from 'fs';
import path from 'path';

const PROJECT_ID = 'analytics-811fc';
const DATABASE_ID = 'default';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

// 1. Get OAuth Token from firebase-tools.json
function getAccessToken() {
  const home = process.env.USERPROFILE || process.env.HOME;
  const p = path.join(home, '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(p)) throw new Error('Firebase credentials not found at: ' + p);
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  const token = cfg.tokens?.access_token;
  if (!token) throw new Error('No access_token found in firebase-tools.json');
  return token;
}

// 2. Value Converter
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// 3. Batch Write Executor
async function commitBatch(token, writes) {
  const url = `${BASE_URL}:batchWrite`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ writes })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`BatchWrite HTTP ${res.status}: ${errText}`);
  }
  return res.json();
}

// 4. Read Users from scratch/users.json
function getSqliteUsers() {
  const p = path.resolve('scratch/users.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function main() {
  console.log('=== MEMULAI SINKRONISASI DATA KE GOOGLE CLOUD FIRESTORE ===');
  console.log(`Project: ${PROJECT_ID} | Database: ${DATABASE_ID}`);
  const token = getAccessToken();
  console.log('✓ Kredensial Firebase CLI / Google Cloud OAuth berhasil dibaca.');

  // Load JSON Master
  console.log('\n[1/6] Membaca data master sitac_collo_data.json & telecom_portal.db...');
  const jsonRaw = JSON.parse(fs.readFileSync('sitac_collo_data.json', 'utf8'));
  const users = await getSqliteUsers();
  console.log(`✓ Data berhasil dimuat:`);
  console.log(`  - Summary: Executive KPIs & Analytics`);
  console.log(`  - Users: ${users.length} akun`);
  console.log(`  - Sitac Records: ${jsonRaw.sitac_records?.length || 0} PA`);
  console.log(`  - Gangguan Records: ${jsonRaw.gangguan_records?.length || 0} tiket`);
  console.log(`  - Collo Records: ${jsonRaw.collo_records?.length || 0} sirkuit`);
  console.log(`  - Rekap Efisiensi: ${jsonRaw.rekap_efisiensi?.length || 0} tahun`);

  const collections = [
    {
      name: 'summary',
      items: [{ id: 'executive_summary', ...jsonRaw.summary }]
    },
    {
      name: 'users',
      items: users.map(u => ({ id: `user_${u.username}`, ...u }))
    },
    {
      name: 'rekap_efisiensi',
      items: (jsonRaw.rekap_efisiensi || []).map(r => ({ id: `tahun_${r.tahun || r.id}`, ...r }))
    },
    {
      name: 'sitac_records',
      items: (jsonRaw.sitac_records || []).map((s, idx) => ({ id: `sitac_${s.id || idx + 1}`, ...s }))
    },
    {
      name: 'gangguan_records',
      items: (jsonRaw.gangguan_records || []).map((g, idx) => ({ id: `ticket_${g.id || g.no_tiket || idx + 1}`, ...g }))
    },
    {
      name: 'collo_records',
      items: (jsonRaw.collo_records || []).map((c, idx) => ({ id: `collo_${c.id || idx + 1}`, ...c }))
    }
  ];

  let totalUploaded = 0;
  const startTime = Date.now();

  for (const col of collections) {
    const count = col.items.length;
    console.log(`\n--> Mengunggah koleksi '${col.name}' (${count} dokumen)...`);
    const batchSize = 250;

    for (let i = 0; i < count; i += batchSize) {
      const chunk = col.items.slice(i, i + batchSize);
      const writes = chunk.map(item => {
        const docId = String(item.id);
        const docPath = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${col.name}/${docId}`;
        const fields = {};
        for (const [k, v] of Object.entries(item)) {
          if (k !== 'id') {
            fields[k] = toFirestoreValue(v);
          }
        }
        return {
          update: {
            name: docPath,
            fields: fields
          }
        };
      });

      await commitBatch(token, writes);
      totalUploaded += chunk.length;
      console.log(`    [${col.name}] Progress: ${Math.min(i + batchSize, count)} / ${count} dokumen tersinkronisasi.`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n======================================================`);
  console.log(`🎉 BERHASIL MENGUNGGAH SEMUA DATA KE CLOUD FIRESTORE!`);
  console.log(`Total Dokumen Tersimpan: ${totalUploaded}`);
  console.log(`Waktu Unggah: ${duration} detik`);
  console.log(`Project: https://console.firebase.google.com/project/${PROJECT_ID}/firestore/databases/${DATABASE_ID}/data`);
  console.log(`======================================================`);
}

main().catch(err => {
  console.error('\n[FATAL ERROR]:', err);
  process.exit(1);
});
