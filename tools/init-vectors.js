const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function toFloat32Buffer(arr) {
  const buf = Buffer.allocUnsafe(arr.length * 4);
  for (let i = 0; i < arr.length; i++) buf.writeFloatLE(arr[i] || 0, i * 4);
  return buf;
}

(function main() {
  const dbPath = path.resolve(__dirname, '..', 'sqlite.db');
  const dllEnv = process.env.SQLITE_VEC_DLL || process.env.SQLITE_VSS_DLL || '';
  const dllDefault = path.resolve(__dirname, '..', 'sqlite-extensions', 'vec0');

  console.log(`[init-vectors] sqlite db: ${dbPath}`);
  const db = new Database(dbPath);

 
  try {
    const dllCandidate = dllEnv || dllDefault;
    if (fs.existsSync(dllCandidate + '.dll')) {
      db.loadExtension(dllCandidate + '.dll');
      console.log(`[init-vectors] Loaded extension: ${dllCandidate}.dll`);
    } else if (fs.existsSync(dllCandidate)) {
      db.loadExtension(dllCandidate);
      console.log(`[init-vectors] Loaded extension: ${dllCandidate}`);
    } else {
      console.log('[init-vectors] No vector extension found (skipping). You can set SQLITE_VEC_DLL env or place DLL at sqlite-extensions/vec0.dll');
    }
  } catch (e) {
    console.log('[init-vectors] Extension load failed (continuing without it):', e.message);
  }

  db.pragma('journal_mode = WAL');

  
  db.exec(`
    CREATE TABLE IF NOT EXISTS vec_product_vectors (
      sku TEXT PRIMARY KEY,
      dim INTEGER NOT NULL,
      embedding BLOB NOT NULL
    );
  `);

  
  const srcRows = db.prepare(`SELECT sku, embedding FROM data_ProductVectors`).all();
  if (!srcRows.length) {
    console.log('[init-vectors] Kaynak tabloda veri yok: data_ProductVectors');
    process.exit(0);
  }

  
  let dim = 0;
  for (const r of srcRows) {
    try {
      const v = JSON.parse(r.embedding);
      if (Array.isArray(v) && v.length > 0) { dim = v.length; break; }
    } catch {}
  }
  if (!dim) {
    console.error('[init-vectors] Embedding boyutu algılanamadı. Çıkılıyor.');
    process.exit(1);
  }

  const insert = db.prepare(`
    INSERT INTO vec_product_vectors (sku, dim, embedding)
    VALUES (@sku, @dim, @embedding)
    ON CONFLICT(sku) DO UPDATE SET dim = excluded.dim, embedding = excluded.embedding
  `);

  const tx = db.transaction((rows) => {
    for (const r of rows) {
      let vec = [];
      try { vec = JSON.parse(r.embedding) || []; } catch {}
      if (!Array.isArray(vec) || vec.length !== dim) continue;
      insert.run({ sku: r.sku, dim, embedding: toFloat32Buffer(vec) });
    }
  });

  tx(srcRows);

  const count = db.prepare('SELECT COUNT(*) AS c FROM vec_product_vectors').get().c;
 
  db.close();
})();
