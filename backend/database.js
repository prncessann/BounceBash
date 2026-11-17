'use strict';
require('./config');
const { AsyncLocalStorage } = require('node:async_hooks');
const fs = require('node:fs'); const path = require('node:path');
const storage = new AsyncLocalStorage();
const driver = process.env.DB_DRIVER || (process.env.DATABASE_URL ? 'postgres' : 'sqlite');
if (!['sqlite','postgres','pglite'].includes(driver)) throw new Error('DB_DRIVER must be sqlite or postgres.');
if (process.env.NODE_ENV === 'production' && driver !== 'postgres') throw new Error('Production requires PostgreSQL DATABASE_URL; SQLite is for local use.');
if (driver === 'pglite' && process.env.NODE_ENV !== 'test') throw new Error('Embedded PostgreSQL is reserved for isolated tests.');
let raw, pool, sqlitePath; let tail = Promise.resolve(); let savepoint = 0;
async function exclusive(fn) {
  const previous=tail; let release; tail=new Promise(r=>{release=r;});
  await previous; try{return await fn();}finally{release();}
}
function normalizeRows(rows) {
  return rows.map(row => Object.fromEntries(Object.entries(row).map(([k,v])=>[k,
    typeof v==='string' && /^(id|.*_id|.*_cents|count|n|total|capacity|rental_hours|max_quantity|is_active|email_verified|can_feature|reservation_fee_accepted|attempts|expires_at_ms)$/.test(k) && /^\d+$/.test(v) && Number.isSafeInteger(Number(v)) ? Number(v):v])));
}
function postgresSql(sql, returning) {
  let query=sql.replace(/\s+COLLATE NOCASE/gi,'');
  if (/^INSERT OR REPLACE INTO rate_limits/i.test(query)) query=query.replace('INSERT OR REPLACE','INSERT')+' ON CONFLICT(bucket) DO UPDATE SET count=EXCLUDED.count,expires_at=EXCLUDED.expires_at';
  if (/^INSERT OR IGNORE/i.test(query)) query=query.replace(/INSERT OR IGNORE/i,'INSERT')+' ON CONFLICT DO NOTHING';
  let i=0;query=query.replace(/\?/g,()=>`$${++i}`);
  if (returning && /^\s*INSERT INTO (customers|sessions|packages|add_ons|bookings|reviews|newsletter_subscribers|payments|notifications|audit_events|account_tokens|inquiries|rental_models|model_variants|add_on_options)\b/i.test(query) && !/\bRETURNING\b/i.test(query))query+=' RETURNING id';
  return query;
}
async function execute(sql,args,kind) {
  await db.ready;
  const ctx=storage.getStore();
  async function run() {
    if(driver==='sqlite'){
      const stmt=raw.prepare(sql);
      if(kind==='all')return stmt.all(...args);
      if(kind==='get')return stmt.get(...args);
      const r=stmt.run(...args);return {changes:r.changes,lastInsertRowid:Number(r.lastInsertRowid)};
    }
    const client=ctx ? ctx.client:pool;
    const result=await client.query(postgresSql(sql,kind==='run'),args);
    const rows=normalizeRows(result.rows||[]);
    if(kind==='all')return rows;if(kind==='get')return rows[0];
    return {changes:result.rowCount ?? result.affectedRows ?? rows.length,lastInsertRowid:rows[0] ? Number(rows[0].id):0};
  }
  try {return ctx || driver==='postgres' ? await run():await exclusive(run);}catch(error){
    if(['40001','40P01'].includes(error.code)){error.status=409;error.message='A competing update occurred. Refresh and retry your request.';}
    if(['23503','23514'].includes(error.code)){error.status=400;error.message='The request conflicts with valid catalog or record constraints.';}
    throw error;
  }
}
const db={
  driver,
  prepare(sql){return {get:(...args)=>execute(sql,args,'get'),all:(...args)=>execute(sql,args,'all'),run:(...args)=>execute(sql,args,'run')};},
  transaction(fn){
    async function transaction(...args){
      await db.ready;const ctx=storage.getStore();
      if(ctx){
        const label=`nested_${++savepoint}`;
        const q=async sql=>driver==='sqlite' ? raw.exec(sql):ctx.client.query(sql);
        await q(`SAVEPOINT ${label}`);
        try{const value=await fn(...args);await q(`RELEASE SAVEPOINT ${label}`);return value;}
        catch(e){await q(`ROLLBACK TO SAVEPOINT ${label}`);await q(`RELEASE SAVEPOINT ${label}`);throw e;}
      }
      async function work(){
        if(driver==='sqlite'){
          raw.exec('BEGIN IMMEDIATE');try{const val=await storage.run({client:raw},()=>fn(...args));raw.exec('COMMIT');return val;}catch(e){raw.exec('ROLLBACK');throw e;}
        }
        const client=driver==='postgres' ? await pool.connect():pool;
        try{
          await client.query(driver==='postgres' ? 'BEGIN ISOLATION LEVEL SERIALIZABLE':'BEGIN');
          const val=await storage.run({client},()=>fn(...args));await client.query('COMMIT');return val;
        }catch(e){await client.query('ROLLBACK');if(['40001','40P01'].includes(e.code)){e.status=409;e.message='A competing update occurred. Refresh and retry your request.';}throw e;}
        finally{if(driver==='postgres')client.release();}
      }
      return driver==='postgres' ? work():exclusive(work);
    }
    transaction.immediate=transaction;return transaction;
  },
  async close(){await db.ready;if(driver==='sqlite')raw.close();else if(driver==='postgres')await pool.end();else await pool.close();},
  async backup(target){await db.ready;if(driver!=='sqlite')throw new Error('Use pg_dump or Supabase backup/restore for PostgreSQL.');return exclusive(()=>raw.backup(target));},
};
db.ready=(async()=>{
  if(driver==='sqlite'){
    const local=require('./database-local');raw=local.db;sqlitePath=local.dbPath;return;
  }
  if(driver==='pglite'){
    const {PGlite}=require('@electric-sql/pglite');pool=new PGlite(process.env.PGLITE_PATH || 'memory://');await pool.waitReady;
  }else{
    if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required for PostgreSQL.');
    const {Pool,types}=require('pg');types.setTypeParser(20,v=>Number(v));
    const url=new URL(process.env.DATABASE_URL);for(const p of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(p);
    const ssl=process.env.DATABASE_SSL==='false' ? false:{rejectUnauthorized:true,...(process.env.DATABASE_CA_CERT ? {ca:process.env.DATABASE_CA_CERT}:{})};
    if(process.env.NODE_ENV==='production' && ssl===false)throw new Error('Production PostgreSQL requires TLS.');
    pool=new Pool({connectionString:url.href,ssl,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,options:'-c search_path=bouncebash,public'});
    pool.on('error',error=>console.error('PostgreSQL idle connection error:',error.code||'DB_ERROR'));
  }
  const schema=fs.readFileSync(path.join(__dirname,'..','migrations','001_postgres.sql'),'utf8');
  if(driver==='pglite'){const installed=await pool.query("SELECT to_regclass('bouncebash.schema_migrations') AS present");if(!installed.rows[0].present)await pool.exec(schema);else await pool.exec('SET search_path TO bouncebash,public');}
  else{
    const client=await pool.connect();try{
      await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(42037001)');
      const installed=await client.query("SELECT to_regclass('bouncebash.schema_migrations') AS present");
      if(!installed.rows[0].present)await client.query(schema);
      await client.query('COMMIT');
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  // Parameterized seeds preserve operator edits; no fabricated prices or model mappings.
  for(const [name,description] of [['Little Bounce','Smaller birthday groups.'],['Ball Pit Bash','Ball pit setup.'],['Bash & Bounce','Bounce party setup.'],['The Luxe Bash','Premium styling package.']])await pool.query('INSERT INTO packages(name,description) VALUES($1,$2) ON CONFLICT DO NOTHING',[name,description]);
  for(const name of ['Ball colors','Balloon garland','Balloon arch','Backdrop & signage','Table styling','Extra hour'])await pool.query('INSERT INTO add_ons(name) VALUES($1) ON CONFLICT DO NOTHING',[name]);
  for(const [slug,name]of[['dry','Dry Zone'],['splash','Splash Zone'],['ball-pit','Ball Pit Zone']])await pool.query('INSERT INTO rental_zones(slug,name) VALUES($1,$2) ON CONFLICT DO NOTHING',[slug,name]);
})();
async function audit(actor,action,entity,id,detail={}){await db.prepare('INSERT INTO audit_events(actor,action,entity,entity_id,detail) VALUES (?,?,?,?,?)').run(actor,action,entity,String(id),JSON.stringify(detail));}
module.exports={db,audit,get dbPath(){return sqlitePath;}};
