'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');const {JSDOM}=require('jsdom');const {fixture}=require('../tests/support-fixture.cjs');const root=path.resolve(__dirname,'..'),source=x=>fs.readFileSync(path.join(root,'Bouncebash_CS',x),'utf8');const tick=()=>new Promise(r=>setTimeout(r,15));
async function wait(fn,message){for(let i=0;i<200;i++){if(fn())return;await tick();}assert.fail(message);}
test('Manage Booking buttons persist changes against backend under normal production-style limits',async t=>{
 const f=await fixture({PUBLIC_RATE_LIMIT:'20'});t.after(()=>f.close());const api=f.api;
 const signed=await api('/api/auth/signup',{method:'POST',body:{name:'Manage QA',email:'manage@example.test',password:'TestPassword123!'}});const cookie=signed.cookie;
 const catalog=(await api('/api/catalog')).data;const m=catalog.models[0];const body={rentalId:m.id,packageId:m.booking_package_id,variantId:catalog.variants.find(v=>v.model_id===m.id).id,name:'Manage QA',contact:'09123456789',eventDate:'2090-07-01',eventTime:'10:00',venue:'QA venue',cityId:'quezon-city',extraHours:0,notes:'',addOnItems:[],reservationFeeAccepted:true};
 await t.test('30 price previews do not exhaust booking submissions',async()=>{for(let i=0;i<30;i++)assert.equal((await api('/api/quotes',{method:'POST',body})).status,200);});
 const created=await api('/api/bookings',{method:'POST',cookie,body});assert.equal(created.status,201,JSON.stringify(created.data));const ref=created.data.booking.reference;
 const dom=new JSDOM(source('manage-booking.html'),{url:'http://localhost/Bouncebash_CS/manage-booking.html?reference='+ref,runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());const w=dom.window,d=w.document,toasts=[];w.BBNotify={banner(){},success:s=>toasts.push(s),error:s=>toasts.push(s)};let postCalls=0, losePaymentResponse=false;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.fetch=async(url,opts={})=>{if(opts.method==='POST')postCalls++;const r=await api(url,{method:opts.method||'GET',body:opts.body?JSON.parse(opts.body):undefined,cookie});if(losePaymentResponse&&url.endsWith('/payments'))throw new TypeError('Failed to fetch');return {ok:r.status<400,status:r.status,json:async()=>r.data,headers:r.headers};};
 w.eval(source('payment-config.js'));w.eval(source('hold-timer.js'));w.eval(source('customer-tools.js')+'\nwindow.testPaymentMethods=configuredPaymentMethods;');d.dispatchEvent(new w.Event('DOMContentLoaded'));await wait(()=>!d.getElementById('manage-actions').hidden,'Booking did not load');
 const $=id=>d.getElementById(id);const submit=id=>$(id).querySelector('[type=submit]').click();
 assert.deepEqual(Array.from($('payment-method').options, option=>option.value),['GCash']);
 const methods=w.testPaymentMethods;
 const bank={bankName:'Demo bank',accountName:'Demo recipient',accountNumber:'synthetic'};
 assert.deepEqual(Array.from(methods({bank,cash:{instructions:'Demo instructions'}})),[]);
 assert.deepEqual(Array.from(methods({bank:{...bank,businessApproved:true,accountNumber:' '},cash:{businessApproved:true,instructions:''}})),[]);
 assert.deepEqual(Array.from(methods({bank:{...bank,businessApproved:true},cash:{businessApproved:true,instructions:'Demo instructions'}})),['Bank transfer','Cash']);
 await t.test('unchanged schedule shows a nearby explanation instead of a silent failure',async()=>{$('open-reschedule').click();submit('reschedule-booking-form');assert.match($('reschedule-message').textContent,/different date or time/);assert.equal($('move-date').getAttribute('aria-invalid'),'true');});
 await t.test('reschedule button updates backend and both calendar dates',async()=>{$('move-date').value='2090-07-02';$('move-time').value='11:30';submit('reschedule-booking-form');await wait(()=>$('reschedule-result').textContent.includes('Reschedule requested'),'Reschedule did not finish');const b=(await api('/api/bookings/'+ref,{cookie})).data.booking;assert.equal(b.event_date,'2090-07-02');assert.equal(b.event_time,'11:30');assert.equal((await api('/api/availability?date=2090-07-01')).data.available,true);assert.equal((await api('/api/availability?date=2090-07-02')).data.available,false);});
 await t.test('payment invalid fields receive visible errors without API submission',async()=>{const n=postCalls;$('payment-reference').value='';submit('payment-reference-form');assert.equal(postCalls,n);assert.equal($('payment-reference').getAttribute('aria-invalid'),'true');assert.match($('payment-message').textContent,/highlighted/);});
 await t.test('payment submit records cents, prevents repeat clicks and shows pending history',async()=>{$('payment-amount').value='2499.99';$('payment-reference').value='1111111';const n=postCalls;submit('payment-reference-form');submit('payment-reference-form');await wait(()=>$('payment-message').textContent==='Payment reference submitted. Your payment is awaiting verification.','Payment did not finish');assert.equal(postCalls,n+1);const b=(await api('/api/bookings/'+ref,{cookie})).data.booking;assert.equal(b.payments.length,1);assert.equal(b.payments[0].amount_cents,249999);assert.equal(b.payments[0].status,'pending');assert.match($('payment-history').textContent,/1111111/);assert.match($('payment-pending-note').textContent,/awaiting verification/);assert.equal($('payment-reference-form').querySelector('button').disabled,false);});
 await t.test('server rejects duplicate references and the error is shown beside the payment form',async()=>{$('payment-amount').value='1';$('payment-reference').value='1111111';submit('payment-reference-form');await wait(()=>$('payment-message').dataset.state==='error','No duplicate reference error');assert.match($('payment-message').textContent,/duplicate|already/i);});
 await t.test('repeated owner reads cannot block reschedule writes',async()=>{for(let i=0;i<25;i++)assert.equal((await api('/api/bookings/'+ref,{cookie})).status,200);$('open-reschedule').click();$('move-date').value='2090-07-03';$('move-time').value='12:00';submit('reschedule-booking-form');await wait(()=>$('reschedule-result').textContent.includes('Reschedule requested'),'Reschedule did not finish');assert.equal((await api('/api/bookings/'+ref,{cookie})).data.booking.payments.length,1);});
 await t.test('a lost payment response preserves inputs and directs customers to check saved state',async()=>{
  losePaymentResponse=true;
  $('payment-amount').value='1';
  $('payment-reference').value='2222222';
  submit('payment-reference-form');
  assert.equal($('payment-reference-form').getAttribute('aria-busy'),'true');
  await wait(()=>$('payment-message').textContent.includes('whether your change was saved'),'Recovery instructions did not appear');
  losePaymentResponse=false;
  assert.equal($('payment-reference').value,'2222222');
  assert.equal($('payment-reference-form').querySelector('button').disabled,false);
  const booking=(await api('/api/bookings/'+ref,{cookie})).data.booking;
  assert.equal(booking.payments.filter(payment=>payment.reference==='2222222'&&payment.status==='pending').length,1);
 });
 await t.test('success and error notifications are visible',()=>assert.ok(toasts.length>=4));
});
test('quote/read/action rate protection remains active in independent buckets',async t=>{
 const f=await fixture({PUBLIC_RATE_LIMIT:'1',QUOTE_RATE_LIMIT:'2'});t.after(()=>f.close());const invalid={packageName:'Little Bounce',cityId:'quezon-city'};
 assert.equal((await f.api('/api/quotes',{method:'POST',body:invalid})).status,409);assert.equal((await f.api('/api/quotes',{method:'POST',body:invalid})).status,409);const limited=await f.api('/api/quotes',{method:'POST',body:invalid});assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);assert.equal((await f.api('/api/newsletter',{method:'POST',body:{email:'limit@example.test'}})).status,201);
});
