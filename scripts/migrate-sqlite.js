'use strict';
require('../backend/config');
const path=require('node:path');const fs=require('node:fs');const Database=require('better-sqlite3');const {db}=require('../backend/database');
(async()=>{
 if(db.driver!=='postgres' && !(db.driver==='pglite' && process.env.NODE_ENV==='test'))throw new Error('Set DATABASE_URL and DB_DRIVER=postgres for the destination.');
 const args=process.argv.slice(2);if(!args[0]||!args.includes('--confirm-empty-destination'))throw new Error('Usage: npm run migrate:sqlite -- PATH_TO_BACKUP.sqlite --confirm-empty-destination');
 const source=path.resolve(args[0]);if(!fs.existsSync(source))throw new Error('Source database not found.');
 const sqlite=new Database(source,{readonly:true,fileMustExist:true});
 try{
   await db.ready;
   if(sqlite.pragma('integrity_check',{simple:true})!=='ok')throw new Error('Source integrity check failed.');
   const tables=['customers','packages','add_ons','rental_zones','rental_models','model_variants','package_models','add_on_options','bookings','booking_add_ons','payments','inquiries','reviews','newsletter_subscribers','date_blocks','audit_events','notifications'];
   let imported=0;
   await db.transaction(async()=>{
    for(const name of tables.filter(n=>!['packages','add_ons','rental_zones'].includes(n)))if((await db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get()).n>0)throw new Error('Destination contains business data. Import refused; use a new empty database.');
    // Only replace automatic catalog seeds in an otherwise empty destination.
    await db.prepare('DELETE FROM packages').run();await db.prepare('DELETE FROM add_ons').run();await db.prepare('DELETE FROM rental_zones').run();
    for(const table of tables){
      if(!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))continue;
      const allowed=(await db.prepare("SELECT column_name FROM information_schema.columns WHERE table_schema='bouncebash' AND table_name=?").all(table)).map(r=>r.column_name);
      for(const row of sqlite.prepare(`SELECT * FROM ${table}`).all()){
        const keys=Object.keys(row).filter(k=>allowed.includes(k)&&/^[a-z_]+$/.test(k));
        // Do not migrate expired/raw recovery emails or bearer links; the customer can request new ones.
        if(table==='notifications' && (row.kind?.startsWith('account.')||row.kind==='booking.created'))continue;
        if(!keys.length)continue;
        await db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>row[k]));imported++;
      }
      if(allowed.includes('id'))await db.prepare(`SELECT setval(pg_get_serial_sequence('bouncebash.${table}','id'),COALESCE(MAX(id),1),COUNT(*)>0) FROM ${table}`).get();
    }
   })();
   console.log(`Imported ${imported} rows. Original SQLite file was opened read-only. Existing sessions/recovery tokens were not imported; customers must sign in again.`);
 }finally{sqlite.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.close());
