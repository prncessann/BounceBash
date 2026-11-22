'use strict';
require('../backend/config');
const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

(async () => {
  const driver = process.env.DB_DRIVER || (process.env.DATABASE_URL ? 'postgres' : 'sqlite');
  if (driver !== 'sqlite' || process.env.NODE_ENV === 'production') {
    throw new Error('Use pg_dump or the provider backup tools for PostgreSQL.');
  }
  const source = path.resolve(process.env.BOUNCEBASH_DB_PATH || process.env.DB_PATH || path.join(__dirname, '..', 'data', 'bouncebash.sqlite'));
  const target = path.resolve(process.argv[2] || path.join(__dirname, '..', 'backups', `bouncebash-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`));
  if (fs.existsSync(target)) throw new Error('Backup target already exists; choose a new filename.');
  // Opening the application adapter can upgrade the database before it is backed up.
  const db = new Database(source, { readonly: true, fileMustExist: true });
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await db.backup(target);
  } finally {
    db.close();
  }
  console.log(`Consistent SQLite backup created: ${target}`);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
