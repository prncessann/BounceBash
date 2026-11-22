'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bouncebash-database-'));
process.env.NODE_ENV='test';process.env.DB_DRIVER=process.env.DB_DRIVER === 'pglite' ? 'pglite' : 'sqlite';process.env.BOUNCEBASH_DB_PATH=path.join(temp,'test.sqlite');process.env.PGLITE_PATH=path.join(temp,'postgres');
const {db,audit}=require('../backend/database');
test('database transactions, immutable audit, backups and access schema',async t=>{
 await db.ready;t.after(async()=>{await db.close();fs.rmSync(temp,{recursive:true,force:true});});
 await t.test('failed transaction rolls back inserted rows',async()=>{
  await assert.rejects(db.transaction(async()=>{await db.prepare('INSERT INTO newsletter_subscribers(email) VALUES (?)').run('rollback@example.test');throw new Error('synthetic failure');})());
  assert.equal(await db.prepare('SELECT id FROM newsletter_subscribers WHERE email=?').get('rollback@example.test'),undefined);
 });
 await t.test('nested conversion transaction can roll back to savepoint',async()=>{
  await db.transaction(async()=>{
   await db.prepare('INSERT INTO newsletter_subscribers(email) VALUES (?)').run('outer@example.test');
   await assert.rejects(db.transaction(async()=>{await db.prepare('INSERT INTO newsletter_subscribers(email) VALUES (?)').run('inner@example.test');throw new Error('inner rollback');})());
  })();
  assert.ok(await db.prepare('SELECT id FROM newsletter_subscribers WHERE email=?').get('outer@example.test'));assert.equal(await db.prepare('SELECT id FROM newsletter_subscribers WHERE email=?').get('inner@example.test'),undefined);
 });
 await t.test('audit records reject edits and deletes',async()=>{await audit('test','test.audit','test',1);await assert.rejects(db.prepare("UPDATE audit_events SET action='modified'").run());await assert.rejects(db.prepare('DELETE FROM audit_events').run());});
 await t.test('application schema contains inquiry and payment tables',async()=>{assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM inquiries').get()).n,0);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM payments').get()).n,0);});
 if(db.driver==='sqlite')await t.test('online backup can be reopened with intact data',async()=>{const file=path.join(temp,'backup.sqlite');await db.backup(file);const Database=require('better-sqlite3');const restored=new Database(file,{readonly:true});assert.equal(restored.pragma('integrity_check',{simple:true}),'ok');assert.ok(restored.prepare('SELECT id FROM newsletter_subscribers WHERE email=?').get('outer@example.test'));assert.deepEqual(restored.pragma('foreign_key_check'),[]);restored.close();});
 else await t.test('PostgreSQL tables have row-level security enabled',async()=>{const rows=await db.prepare("SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='bouncebash' AND c.relkind='r'").all();assert.ok(rows.length>=20);assert.ok(rows.every(r=>r.relrowsecurity));});
});
test('SQLite-to-PostgreSQL importer preserves records in a new empty destination',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'bouncebash-import-'));
 try{
  const Database=require('better-sqlite3');const source=path.join(folder,'source.sqlite');const sql=new Database(source);sql.exec("CREATE TABLE customers(id INTEGER PRIMARY KEY,name TEXT,email TEXT,password_hash TEXT,phone TEXT,city TEXT,address TEXT,created_at TEXT,updated_at TEXT); INSERT INTO customers VALUES(1,'Synthetic legacy','legacy@example.test','not-a-real-password-hash','','','','2026-01-01','2026-01-01'); CREATE TABLE packages(id INTEGER PRIMARY KEY,name TEXT,description TEXT,base_price REAL,is_active INTEGER,created_at TEXT); INSERT INTO packages VALUES(1,'Legacy package','Synthetic',1000,1,'2026-01-01');");sql.exec("CREATE TABLE business_configuration(setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL); INSERT INTO business_configuration VALUES ('synthetic','preserved'); CREATE TABLE staff_users(id TEXT PRIMARY KEY,email TEXT,password_hash TEXT,name TEXT,created_at TEXT); INSERT INTO staff_users VALUES ('synthetic-staff','staff-import@example.test','synthetic','Synthetic staff','2026-01-01');");sql.close();
  const env={...process.env,NODE_ENV:'test',DB_DRIVER:'pglite',PGLITE_PATH:path.join(folder,'destination')};
  const args=['scripts/migrate-sqlite.js',source,'--confirm-empty-destination'];const result=spawnSync(process.execPath,args,{cwd:path.resolve(__dirname,'..'),env,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const verify=spawnSync(process.execPath,['-e',"(async()=>{const {db}=require('./backend/database');await db.ready;const c=await db.prepare('SELECT * FROM customers WHERE id=1').get();const settings=await db.prepare('SELECT setting_value FROM business_configuration WHERE setting_key=?').get('synthetic');const staff=await db.prepare('SELECT name FROM staff_users WHERE id=?').get('synthetic-staff');if(c.name!=='Synthetic legacy'||settings?.setting_value!=='preserved'||staff?.name!=='Synthetic staff')process.exitCode=1;await db.close();})().catch(e=>{console.error(e);process.exitCode=1;});"],{cwd:path.resolve(__dirname,'..'),env,encoding:'utf8'});assert.equal(verify.status,0,verify.stderr);
  const replay=spawnSync(process.execPath,args,{cwd:path.resolve(__dirname,'..'),env,encoding:'utf8'});assert.equal(replay.status,1);assert.ok(replay.stderr.includes('Destination contains business data'));
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test('production configuration requires HTTPS and enables Secure cookies',()=>{
 const root=path.resolve(__dirname,'..');
 const common={...process.env,NODE_ENV:'production',PUBLIC_URL:'https://example.test',OPERATOR_API_KEY:'production-configuration-test-key-123456789'};
 const valid=spawnSync(process.execPath,['-e',"const c=require('./backend/config');if(!c.secureCookies)process.exit(1)"],{cwd:root,env:common,encoding:'utf8'});assert.equal(valid.status,0,valid.stderr);
 const invalid=spawnSync(process.execPath,['-e',"require('./backend/config')"],{cwd:root,env:{...common,PUBLIC_URL:'http://example.test'},encoding:'utf8'});assert.equal(invalid.status,1);
});

test('payment proof upgrade preserves an existing payment and rolls back a failed proof write', async () => {
 const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncebash-proof-upgrade-'));
 const project = path.resolve(__dirname, '..');
 const driver = process.env.DB_DRIVER;
 const env = { ...process.env, DB_DRIVER: driver, BOUNCEBASH_DB_PATH: path.join(folder, 'legacy.sqlite'), PGLITE_PATH: path.join(folder, 'legacy-pg') };
 function isolated(script) {
   const result = spawnSync(process.execPath, ['-e', script], { cwd: project, env, encoding: 'utf8' });
   assert.equal(result.status, 0, result.stderr);
 }
 const seed = `
   INSERT INTO bookings(id,reference_code,name,contact_number,event_date,event_time,venue,package_name,children_count)
     VALUES(16,'BB-SYNTHETIC','Synthetic user','09120000000','2090-01-01','10:00','Test venue','Little Bounce',1);
   INSERT INTO payments(id,booking_id,amount_cents,reference,method)
     VALUES(17,16,1000,'LEGACY-TEST','GCash');
 `;
 try {
   if (driver === 'pglite') {
     isolated(`(async()=> {
       const { PGlite } = require('@electric-sql/pglite');
       const pg = new PGlite(process.env.PGLITE_PATH);
       await pg.exec(require('fs').readFileSync('migrations/001_postgres.sql','utf8'));
       await pg.exec(${JSON.stringify(seed)});
       await pg.close();
     })().catch(e=>{console.error(e);process.exitCode=1;});`);
   } else {
     isolated(`const { db } = require('./backend/database-local');
       db.exec('DROP TABLE payment_proofs');
       db.exec(${JSON.stringify(seed)});
       db.close();`);
   }
   isolated(`(async()=> {
     const assert = require('node:assert/strict');
     const { db } = require('./backend/database');
     await db.ready;
     assert.equal((await db.prepare('SELECT reference FROM payments WHERE id=?').get(17)).reference,'LEGACY-TEST');
     assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM payment_proofs').get()).n, 0);
     await assert.rejects(db.transaction(async () => {
       await db.prepare('INSERT INTO payments(id,booking_id,amount_cents,reference,method) VALUES (?,?,?,?,?)').run(18,16,1500,'ROLLED-BACK','GCash');
       await db.prepare('INSERT INTO payment_proofs(id,payment_id,media_type,image) VALUES (?,?,?,?)').run('bad-proof',18,'image/png',Buffer.alloc(0));
     })());
     assert.equal(await db.prepare('SELECT id FROM payments WHERE id=?').get(18),undefined);
     assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM payment_proofs').get()).n,0);
     await db.close();
   })().catch(e=>{console.error(e);process.exitCode=1;});`);
 } finally {
   fs.rmSync(folder, { recursive: true, force: true });
 }
});
