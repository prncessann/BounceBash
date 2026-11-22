'use strict';

const {setting,storeSetting}=require('./site-content');

const preferences=['newBooking','paymentReceived','eventReminder','newReview','weeklySummary'];
const who=req=>req.actor?.startsWith('staff:')?req.actor.slice(6):null;
const prefKey=id=>'staff-notices:'+id;
const initial=()=>Object.fromEntries(preferences.map(key=>[key,false]));

function registerStaffNotices({app,db,audit,asyncRoute,fail}){
  app.get('/api/operator/staff-notices',asyncRoute(async(req,res)=>{
    const id=who(req);
    if(!id)fail(403,'Sign in as staff to manage personal preferences.');
    res.json({preferences:{...initial(),...await setting(db,prefKey(id))}});
  }));
  app.put('/api/operator/staff-notices',asyncRoute(async(req,res)=>{
    const id=who(req);
    if(!id)fail(403,'Sign in as staff to manage personal preferences.');
    const after=Object.fromEntries(preferences.map(key=>[key,req.body[key]]));
    if(Object.values(after).some(value=>typeof value!=='boolean'))fail(400,'Specify each notification preference.');
    await db.transaction(async()=>{
      const before=await setting(db,prefKey(id));
      await storeSetting(db,prefKey(id),after);
      await audit(req.actor,'staff.notices_updated','staff',id,{before,after});
    })();
    res.json({success:true});
  }));
}

async function recipients(db) {
  return (await db.prepare(`SELECT s.id,s.email,c.setting_value FROM staff_users s
    JOIN business_configuration c ON c.setting_key='staff-notices:'||s.id`).all())
    .map(row=>({id:row.id,email:row.email,preferences:JSON.parse(row.setting_value)}));
}

function createNoticeQueue({db,enqueue,publicUrl,today}) {
  async function send(person,kind,accessPath,message){
    await enqueue(person.email,'staff.'+kind,{message,url:new URL(accessPath,publicUrl).href});
  }
  async function notify(kind,accessPath,message){
    for(const person of await recipients(db))if(person.preferences[kind])await send(person,kind,accessPath,message);
  }
  async function schedule() {
    const people=(await recipients(db)).filter(person=>person.preferences.eventReminder||person.preferences.weeklySummary);
    if(!people.length)return;
    const day=today();
    const dayTime=Date.parse(day+'T00:00:00Z');
    const nextEventDate=new Date(dayTime+2*86400000).toISOString().slice(0,10);
    await db.transaction(async()=>{
      const bookings=await db.prepare("SELECT id,reference_code FROM bookings WHERE event_date=? AND status='confirmed'").all(nextEventDate);
      for(const person of people){
        async function once(key,kind,url,message){
          const result=await db.prepare('INSERT OR IGNORE INTO business_configuration(setting_key,setting_value) VALUES (?,?)')
            .run('notice-queued:'+person.id+':'+key,JSON.stringify(day));
          if(result.changes)await send(person,kind,url,message);
        }
        if(person.preferences.eventReminder)for(const booking of bookings)await once('event:'+booking.id+':'+nextEventDate,
          'eventReminder','/Bouncebash_Admin/bookings.html?reference='+encodeURIComponent(booking.reference_code),
          'A confirmed booking is scheduled for '+nextEventDate+'.');
        if(person.preferences.weeklySummary&&new Date(dayTime).getUTCDay()===1){
          const previousWeek=new Date(dayTime-7*86400000).toISOString().slice(0,10);
          const {n}=await db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE event_date>=? AND event_date<?').get(previousWeek,day);
          const {n:collected}=await db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS n FROM payments WHERE status='verified' AND replace(substr(created_at,1,19),'T',' ')>=? AND replace(substr(created_at,1,19),'T',' ')<?")
            .get(new Date(Date.parse(previousWeek+'T00:00:00+08:00')).toISOString().slice(0,19).replace('T',' '),new Date(Date.parse(day+'T00:00:00+08:00')).toISOString().slice(0,19).replace('T',' '));
          await once('weekly:'+day,'weeklySummary','/Bouncebash_Admin/reports.html',
            n+' booking events and PHP '+(Number(collected)/100).toFixed(2)+' net verified collections for '+previousWeek+' through the start of '+day+' (Philippine time).');
        }
      }
    })();
  }
  return {notify,schedule};
}
module.exports={registerStaffNotices,createNoticeQueue};

