'use strict';

const assert = require('node:assert/strict');
const { Client } = require('pg');

async function main() {
  if (process.argv[2] !== '--confirm-disposable' || !process.env.BOUNCEBASH_TEST_DATABASE_URL) {
    throw new Error('Set BOUNCEBASH_TEST_DATABASE_URL to an empty, disposable database and pass --confirm-disposable.');
  }
  const connection = new URL(process.env.BOUNCEBASH_TEST_DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(connection.protocol)) throw new Error('Expected a PostgreSQL URL.');
  for (const option of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) connection.searchParams.delete(option);
  process.env.NODE_ENV = 'test';
  process.env.DEMO_CATALOG = 'false';
  process.env.DB_DRIVER = 'postgres';
  process.env.DATABASE_URL = connection.href;
  process.env.DATABASE_SSL = 'true';
  process.env.PUBLIC_URL = 'http://127.0.0.1';
  process.env.OPERATOR_API_KEY = '';
  process.env.NOTIFICATION_WEBHOOK_URL = '';
  process.env.NOTIFICATION_WEBHOOK_KEY = '';
  process.env.CRON_SECRET = '';
  require('../backend/config');

  const ca = process.env.DATABASE_CA_CERT;
  const client = new Client({connectionString: connection.href, ssl: {rejectUnauthorized:true, ...(ca ? {ca} : {})}, connectionTimeoutMillis:10000});
  try {
    await client.connect();
    const {rows:[row]} = await client.query("SELECT current_database() AS name, to_regnamespace('bouncebash') IS NOT NULL AS initialized");
    if (!/[_-]test(?:[_-]|$)/i.test(row.name) || row.initialized) {
      throw new Error('Use a disposable database whose name contains _test or -test and which has no bouncebash schema.');
    }
  } finally {
    await client.end();
  }

  const { db, audit } = require('../backend/database');
  try {
    await db.ready;
    assert.equal(db.driver, 'postgres');
    assert.ok(await db.prepare('SELECT 1 FROM schema_migrations WHERE version=4').get());
    assert.ok(await db.prepare("SELECT 1 FROM pg_indexes WHERE schemaname='bouncebash' AND indexname='idx_active_booking_date'").get());
    const rollback = new Error('Synthetic transaction rollback');
    await assert.rejects(db.transaction(async () => {
      await audit('test', 'remote.smoke', 'test', 1);
      await assert.rejects(db.transaction(async () => {
        await db.prepare("DELETE FROM audit_events WHERE action='remote.smoke'").run();
      })());
      throw rollback;
    })(), error => error === rollback);
    assert.equal(await db.prepare("SELECT 1 FROM audit_events WHERE action='remote.smoke'").get(), undefined);
    console.log('Remote PostgreSQL TLS, migrations, active-date index, immutable audit and rollback passed. The disposable schema remains installed.');
  } finally {
    await db.close();
  }
}

main().catch(error => {
  if (error.code) console.error('Remote verification failed:', error.code);
  else console.error(error instanceof assert.AssertionError ? 'A remote database assertion failed.' : error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]'));
  process.exitCode = 1;
});
