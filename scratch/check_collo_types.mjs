import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('telecom_portal.db');
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
  if (err) console.error(err);
  else {
    console.log('Tables:', tables.map(t => t.name));
    db.all("SELECT jenis_sewa, count(*) as cnt FROM collo GROUP BY jenis_sewa", [], (e, rows) => {
      if (e) console.error(e);
      else console.log('collo jenis_sewa:', rows);
    });
  }
});
