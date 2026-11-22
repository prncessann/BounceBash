'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {spawnSync}=require('node:child_process');const {fixture}=require('../tests/support-fixture.cjs');const root=path.resolve(__dirname,'..');
test('server expiry releases dates, preserves money and never expires confirmed bookings',async t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'bb-expiry-'));
 let f;
 t.after(async()=>{
  try { await f?.close(); }
  finally { fs.rmSync(folder,{recursive:true,force:true}); }
 });
 const env={...process.env,NODE_ENV:'test',DB_DRIVER:process.env.DB_DRIVER==='pglite'?'pglite':'sqlite',BOUNCEBASH_DB_PATH:path.join(folder,'db.sqlite'),PGLITE_PATH:path.join(folder,'pg')};
 const seed=`(async()=>{const {db}=require('./backend/database');await db.ready;for(const [ref,day,status]of [['QA-EXPIRED','2090-06-01','pending'],['QA-CONFIRMED','2090-06-02','confirmed']]){await db.prepare("INSERT INTO bookings(reference_code,name,contact_number,event_date,event_time,venue,package_name,children_count,status,expires_at,total_cents,deposit_cents) VALUES (?,?,? ,?,'10:00','Synthetic venue','Little Bounce',NULL,?,'2000-01-01T00:00:00Z',100000,50000)").run(ref,'QA','09123456789',day,status);}const b=await db.prepare("SELECT id FROM bookings WHERE reference_code='QA-EXPIRED'").get();await db.prepare("INSERT INTO payments(booking_id,amount_cents,reference,method) VALUES (?,50000,'LATE-REFERENCE','GCash')").run(b.id);await db.close();})().catch(e=>{console.error(e);process.exitCode=1;});`;
 const seeded=spawnSync(process.execPath,['-e',seed],{cwd:root,env,encoding:'utf8'});assert.equal(seeded.status,0,seeded.stderr);
 f=await fixture(env);
 const expired=(await f.api('/api/operator/bookings/QA-EXPIRED',{operator:true})).data.booking;assert.equal(expired.status,'expired');assert.equal(expired.payments.length,1);assert.equal(expired.payment_requires_attention,true);assert.equal((await f.api('/api/availability?date=2090-06-01')).data.available,true);
 const confirmed=(await f.api('/api/operator/bookings/QA-CONFIRMED',{operator:true})).data.booking;assert.equal(confirmed.status,'confirmed');assert.equal((await f.api('/api/availability?date=2090-06-02')).data.available,false);
 const review=await f.api('/api/operator/payments/'+expired.payments[0].id,{operator:true,method:'PUT',body:{status:'verified',note:'Received before expiry; reviewed afterward'}});assert.equal(review.status,200,JSON.stringify(review.data));assert.equal((await f.api('/api/operator/bookings/QA-EXPIRED',{operator:true})).data.booking.status,'expired');assert.equal((await f.api('/api/availability?date=2090-06-01')).data.available,true);
});
test('SQLite upgrade preserves historic rows, foreign keys and audit triggers',()=>{
 const Database=require('better-sqlite3');const folder=fs.mkdtempSync(path.join(os.tmpdir(),'bb-upgrade-'));try{const file=path.join(folder,'legacy.sqlite');const db=new Database(file);db.exec(`CREATE TABLE bookings(id INTEGER PRIMARY KEY AUTOINCREMENT,customer_id INTEGER,reference_code TEXT UNIQUE NOT NULL,name TEXT NOT NULL,contact_number TEXT NOT NULL,event_date TEXT NOT NULL,event_time TEXT NOT NULL,venue TEXT NOT NULL,package_name TEXT NOT NULL,children_count INTEGER NOT NULL,selected_style TEXT,add_ons TEXT NOT NULL DEFAULT '[]',notes TEXT NOT NULL DEFAULT '',reservation_fee_accepted INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);INSERT INTO bookings(reference_code,name,contact_number,event_date,event_time,venue,package_name,children_count)VALUES('LEGACY','Historic QA','09123456789','2090-01-01','10:00','Historic venue','Little Bounce',8);CREATE TABLE preserved_links(id INTEGER PRIMARY KEY,booking_id INTEGER REFERENCES bookings(id));INSERT INTO preserved_links VALUES(1,1);`);db.close();const env={...process.env,NODE_ENV:'test',DB_DRIVER:'sqlite',BOUNCEBASH_DB_PATH:file};const script=`(async()=>{const {db}=require('./backend/database');await db.ready;const row=await db.prepare('SELECT * FROM bookings WHERE id=1').get();if(row.children_count!==8||row.reference_code!=='LEGACY')throw Error('History changed');await db.close();})().catch(e=>{console.error(e);process.exitCode=1;});`;
 const target=path.join(folder,'before-upgrade.sqlite');
 const backup=spawnSync(process.execPath,['scripts/backup.js',target],{cwd:root,env,encoding:'utf8'});
 assert.equal(backup.status,0,backup.stderr);
 for(const filename of [file,target]){
  const original=new Database(filename,{readonly:true});
  try{
   assert.equal(original.pragma('table_info(bookings)').find(column=>column.name==='children_count').notnull,1);
   assert.equal(original.prepare('SELECT reference_code FROM bookings WHERE id=1').get().reference_code,'LEGACY');
   assert.deepEqual(original.pragma('foreign_key_check'),[]);
  }finally{original.close();}
 }
 for(let i=0;i<2;i++){const r=spawnSync(process.execPath,['-e',script],{cwd:root,env,encoding:'utf8'});assert.equal(r.status,0,r.stderr);}const check=new Database(file);assert.deepEqual(check.pragma('foreign_key_check'),[]);assert.equal(check.pragma('table_info(bookings)').find(x=>x.name==='children_count').notnull,0);assert.equal(check.prepare('SELECT booking_id FROM preserved_links').get().booking_id,1);check.close();}finally{fs.rmSync(folder,{recursive:true,force:true});}});
