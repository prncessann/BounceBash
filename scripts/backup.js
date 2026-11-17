'use strict';
require('../backend/config');
const path = require('node:path'); const fs = require('node:fs'); const { db } = require('../backend/database');
(async () => {
  const target = path.resolve(process.argv[2] || path.join(__dirname, '..', 'backups', `bouncebash-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`));
  if (fs.existsSync(target)) throw new Error('Backup target already exists; choose a new filename.');
  fs.mkdirSync(path.dirname(target), { recursive: true }); await db.backup(target);
  console.log(`Consistent SQLite backup created: ${target}`);
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.close());
