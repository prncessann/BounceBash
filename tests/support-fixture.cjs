'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');const {once}=require('node:events');const root=path.resolve(__dirname,'..');
const KEY='isolated-test-operator-key-123456789012345';
async function fixture(options={}, createStaff=false){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bouncebash-workflow-'));
  let received=[];let providerFail=false;
  const provider=http.createServer((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{received.push({data:JSON.parse(b),key:req.headers['idempotency-key']});res.statusCode=providerFail?503:200;res.end('{}');});});
  provider.listen(0,'127.0.0.1');await once(provider,'listening');
  const reserve=http.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(r=>reserve.close(r));
  const env={...process.env,NODE_ENV:'test',DB_DRIVER:process.env.DB_DRIVER === 'pglite' ? 'pglite' : 'sqlite',PORT:String(port),PUBLIC_URL:`http://127.0.0.1:${port}`,OPERATOR_API_KEY:KEY,AUTH_RATE_LIMIT:'1000',PUBLIC_RATE_LIMIT:'2000',DEMO_CATALOG:'true',BOUNCEBASH_DB_PATH:path.join(temp,'test.sqlite'),PGLITE_PATH:path.join(temp,'postgres'),NOTIFICATION_WEBHOOK_URL:`http://127.0.0.1:${provider.address().port}`,NOTIFICATION_WEBHOOK_KEY:'test-provider',...options};
  let child;
  async function close() {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    await new Promise(resolve => provider.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }
  try {
    if (createStaff) {
      const created = require('node:child_process').spawnSync(process.execPath,
        ['scripts/create-staff.js', 'staff@example.test', 'Synthetic Staff', 'TestStaffPassword123!'],
        { cwd: root, env, encoding: 'utf8', timeout: 120_000 });
      assert.equal(created.status, 0, created.stderr);
    }
    child=spawn(process.execPath,['server.js'],{cwd:root,env,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',c=>log+=c);child.stderr.on('data',c=>log+=c);
    const base=`http://127.0.0.1:${port}`;let ready=false;
    const deadline=Date.now()+90_000;
    while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(log);try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
    if(!ready)throw new Error('Server not ready: '+log);
    async function api(url,{method='GET',body,cookie,operator,secret,headers={}}={}){
      const r=await fetch(base+url,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(operator?{Authorization:`Bearer ${KEY}`} :{}),...(secret?{'X-Booking-Token':secret}:{}),...headers},body:body===undefined?undefined:typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body)});
      let data;
      if (r.headers.get('content-type')?.startsWith('image/')) data = Buffer.from(await r.arrayBuffer());
      else { const raw = await r.text(); try { data = JSON.parse(raw); } catch { data = raw; } }
      return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};
    }
    return {api,env,temp,received,get logs(){return log;},setProviderFail(v){providerFail=v;},close};
  } catch (error) {
    await close();
    throw error;
  }
}

module.exports={fixture,KEY};
