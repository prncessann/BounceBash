'use strict';
/* Standalone presentation data. No server, real authentication or transfers.
   Loaded only by Admin pages; customer pages and server files are untouched. */
(() => {
  const KEY = 'bouncebash-admin-demo-v1', SESSION = KEY + '-session';
  const nativeFetch = window.fetch.bind(window);
  const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const day = n => new Date(Date.parse(today() + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  const stamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
  const active = b => ['pending', 'confirmed'].includes(b.status);
  const copy = x => JSON.parse(JSON.stringify(x));
  const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
  const cities = ['Quezon City','Caloocan','Malabon','Mandaluyong','Manila','Marikina','Pasig','San Juan','Valenzuela','Las Piñas','Makati','Muntinlupa','Navotas','Parañaque','Pasay','Pateros','Taguig'].map((name, i) => ({ id: ['quezon-city','caloocan','malabon','mandaluyong','manila','marikina','pasig','san-juan','valenzuela','las-pinas','makati','muntinlupa','navotas','paranaque','pasay','pateros','taguig'][i], name, delivery_cents: i === 0 ? 20000 : i < 9 ? 30000 : 40000 }));
  function seed() {
    const names = ['Classic White Castle','Boho Pastel Playground','Rainbow Racer Slide','Carnival Pop Castle','Pastel Ball Pit'];
    const prices = [650000,550000,750000,450000,350000];
    const photos = ['classic-white-castle-balloon-garland.jpg','child-playing-cream-bounce-house.jpg','rainbow-racer-slide-colorful.jpg','carnival-pop-castle-ball-pit.jpg','kids-in-ball-pit-pastel.jpg'];
    const catalog = { zones: [{id:1,name:'Dry Zone'},{id:2,name:'Splash Zone'},{id:3,name:'Ball Pit Zone'}], packages:[],models:[],variants:[],packageModels:[],addOns:[{id:1,name:'Ball colors',unit_price_cents:0,is_active:true},{id:2,name:'Balloon arch',unit_price_cents:40000,is_active:true},{id:3,name:'Backdrop & signage',unit_price_cents:80000,is_active:true}], cities:copy(cities) };
    names.forEach((name,i) => {
      catalog.packages.push({id:i+1,name,description:'Synthetic presentation rental.',base_price_cents:prices[i],rental_hours:4,is_active:true,inclusions:JSON.stringify(['4 rental hours','Setup and pickup'])});
      catalog.models.push({id:i+1,name,zone_id:i===2?2:i===4?3:1,capacity:10,image_url:'../assets/photos/'+photos[i],description:'Demo rental photo',booking_package_id:i+1,includes_balls:i!==2&&i!==3,is_active:true});
      catalog.packageModels.push({package_id:i+1,model_id:i+1});
      ['White','Pastel'].forEach((name,j)=>catalog.variants.push({id:i*2+j+1,model_id:i+1,name,is_active:true}));
    });
    const state = { version:1,catalog,bookings:[],payments:[],blocks:[{event_date:day(10),reason:'Demo maintenance day'}],inquiries:[],articles:[],reviews:[],audit:[],notifications:[],preferences:{newBooking:true,paymentReceived:true,eventReminder:true,newReview:true,weeklySummary:false},policy:{extraHourCents:60000,extras:{'Balloon arch':40000,'Backdrop & signage':80000},cities:copy(cities)},settings:{contact:{name:'Bounce Bash — Demo',email:'hello@bouncebash.example',phone:'00000000000',area:'Metro Manila',hours:'9 AM–6 PM'},payment:{gcash:{name:'DEMO ONLY',number:'00000000000'},bank:{businessApproved:false},cash:{businessApproved:false,instructions:''},note:'Synthetic demo instructions. Do not send money.'}} };
    const offsets=[0,1,2,3,4,6,8,12,15,-3,-12,-33,-62,-92,-123,-153];
    offsets.forEach((offset,i)=>{
      const p=catalog.packages[i%5],total=p.base_price_cents+20000+(i%3===0?40000:0);
      const status=i>=9?'completed':i===7?'cancelled':i%3===0?'pending':'confirmed';
      const unknown=i===6;
      const b={id:i+1,reference:'DEMO-BB-'+String(i+1).padStart(4,'0'),name:'Demo Customer '+String(i+1).padStart(2,'0'),contact_number:'00000000000',email:'customer'+(i+1)+'@example.test',event_date:day(offset),event_time:'14:00',venue:'Demo Event Venue '+(i+1),city_id:'quezon-city',package_name:p.name,package_id:p.id,rental_id:p.id,status,pricing_state:unknown?'pending_quote':'final',subtotal_cents:total,total_cents:unknown?null:total,deposit_cents:unknown?null:Math.ceil(total/2),notes:unknown?'Demo special setup quotation request.':'',created_at:day(offset-4)+' 08:00:00',expires_at:status==='pending'?new Date(Date.now()+3*3600000).toISOString():null,selection:i%3===0?[{name:'Balloon arch',quantity:1,colors:['White','Gold'],unit_price_cents:40000}]:[],quote:{model_name:p.name,package_name:p.name,variant:'White',rental_hours:4,base_price_cents:p.base_price_cents,extra_hours:0,extra_hours_cents:0,delivery_cents:20000,subtotal_cents:total}};
      state.bookings.push(b);
      if(!unknown&&i!==0&&i!==3&&i!==7)state.payments.push({id:i+1,booking_id:b.id,reference:'DEMO-PAY-'+(i+1),method:i%2?'GCash':'Cash',amount_cents:i%3===1?Math.ceil(total/2):total,status:i===5?'pending':'verified',created_at:(i===1?today():day(Math.min(offset,0)))+' 07:00:00'});
    });
    state.inquiries=[{id:1,name:'Demo Inquiry Customer',contact:'00000000000',status:'new',reply:'',details:JSON.stringify({eventDate:day(20),eventTime:'10:00',packageName:names[0],rentalId:1,notes:'Please advise on outdoor setup.'})}];
    state.articles=[{slug:'demo-party-planning',title:'Planning a relaxed birthday party',summary:'Synthetic article for the Admin presentation.',category:'Party planning',date_label:'Demo article',image:'../assets/photos/bounce-house-garden-kids.jpg',image_alt:'Inflatable party setup',state:'published',provenance:'synthetic-demo',revision:1,blocks:[{tag:'p',children:['Plan your venue, rental and decorations in advance. This is demonstration content.']}]}];
    state.reviews=[{id:1,name:'Demo Reviewer One',message:'The demo booking screens were easy to follow.',rating:5,can_feature:true,moderation_status:'approved',featured:true,archived:false},{id:2,name:'Demo Reviewer Two',message:'A sample review awaiting staff moderation.',rating:4,can_feature:true,moderation_status:'pending',featured:false,archived:false}];
    state.notifications=[{id:1,kind:'Demo booking reminder',status:'sent',attempts:1,last_error:''}];
    return state;
  }
  let state;
  try { state=JSON.parse(localStorage.getItem(KEY)); } catch {}
  if(!state||state.version!==1)state=seed();
  function save() { try { localStorage.setItem(KEY,JSON.stringify(state)); } catch { /* In-memory demo still works when storage is unavailable. */ } }
  save();
  let signedIn=false;
  try { signedIn=sessionStorage.getItem(SESSION)==='yes'; } catch {}
  function login(value) { signedIn=value;try { value?sessionStorage.setItem(SESSION,'yes'):sessionStorage.removeItem(SESSION); } catch {} }
  const nextId = list => Math.max(0,...list.map(x=>Number(x.id)||0))+1;
  const paymentRows = b => state.payments.filter(p=>p.booking_id===b.id);
  function booking(b) {
    const payments=paymentRows(b),paid=payments.filter(p=>p.status==='verified').reduce((a,p)=>a+p.amount_cents,0),pending=payments.filter(p=>p.status==='pending').reduce((a,p)=>a+p.amount_cents,0);
    return {...b,reference_code:b.reference,payments:copy(payments),paid_cents:paid,verified_cents:paid,pending_cents:pending,balance_cents:b.total_cents==null?null:Math.max(0,b.total_cents-paid),upcoming:active(b)&&Date.parse(b.event_date+'T'+b.event_time+':00+08:00')>Date.now()};
  }
  function findBooking(ref) { const b=state.bookings.find(b=>b.reference===ref);if(!b)fail('Demo booking not found.',404);return b; }
  function checkDate(date,except) { if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))fail('Choose a valid date.');if(state.blocks.some(x=>x.event_date===date)||state.bookings.some(b=>b!==except&&active(b)&&b.event_date===date))fail('That date is unavailable in the demo.',409); }
  function amount(value) { const n=Number(value);if(!Number.isFinite(n)||n<=0)fail('Enter a positive amount.');return Math.round(n*100); }
  function overview(q) {
    const from=q.get('from')||'2000-01-01',to=q.get('to')||'2100-12-31',filter=q.get('status')||'';
    if(from>to)fail('The start date must be before the end date.');
    const bookings=state.bookings.map(booking).filter(b=>b.event_date>=from&&b.event_date<=to&&(!filter||b.status===filter));
    const payments=state.payments.flatMap(p=>{const b=state.bookings.find(b=>b.id===p.booking_id);return b&&(!filter||b.status===filter)&&p.created_at.slice(0,10)>=from&&p.created_at.slice(0,10)<=to?[{...p,reference_code:b.reference,booking_status:b.status}]:[];});
    const totals={bookings:bookings.length,pending:0,confirmed:0,upcoming:0,unknown_quotes:0,outstanding_cents:0,known_booking_value_cents:0,verified_collected_cents:0,recorded_refunded_cents:0,gross_collections_cents:0,net_collections_cents:0,pending_reference_cents:0,pending_references:0,unresolved_inactive_cents:0};
    const extras=new Map();
    for(const b of bookings){if(b.status==='pending')totals.pending++;if(b.status==='confirmed')totals.confirmed++;if(b.upcoming)totals.upcoming++;totals.known_booking_value_cents+=b.total_cents||0;if(active(b)){if(b.total_cents==null)totals.unknown_quotes++;else totals.outstanding_cents+=b.balance_cents;}else if(['cancelled','expired'].includes(b.status))totals.unresolved_inactive_cents+=b.paid_cents+b.pending_cents;for(const a of b.selection||[])extras.set(a.name,(extras.get(a.name)||0)+(a.quantity||1));}
    for(const p of payments){if(p.status==='verified')totals.verified_collected_cents+=p.amount_cents;if(p.status==='refunded')totals.recorded_refunded_cents+=p.amount_cents;if(p.status==='pending'){totals.pending_reference_cents+=p.amount_cents;totals.pending_references++;}}
    totals.net_collections_cents=totals.verified_collected_cents;totals.gross_collections_cents=totals.net_collections_cents+totals.recorded_refunded_cents;
    return {bookings,payments,totals,extras:[...extras],from,to,today:today(),refreshed_at:new Date().toISOString()};
  }
  function createBooking(v) {
    if(!v.name?.trim()||!v.venue?.trim())fail('Customer name and venue are required.');
    if(!v.reservationFeeAccepted)fail('Acknowledge the demo deposit policy.');checkDate(v.eventDate);
    const model=state.catalog.models.find(m=>m.id===Number(v.rentalId)&&m.is_active),offer=model&&state.catalog.packages.find(p=>p.id===model.booking_package_id&&p.is_active);
    if(!offer||!Number.isInteger(offer.base_price_cents))fail('Select an active priced rental.');
    const city=state.policy.cities.find(c=>c.id===v.cityId);if(!city)fail('Select a delivery location.');
    const hours=Number(v.extraHours)||0;if(!Number.isInteger(hours)||hours<0||hours>12)fail('Additional hours must be between 0 and 12.');
    if(!/^\d{2}:\d{2}$/.test(v.eventTime||''))fail('Choose an event time.');
    const total=offer.base_price_cents+city.delivery_cents+hours*state.policy.extraHourCents,id=nextId(state.bookings),unknown=!!v.notes?.trim();
    const b={id,reference:'DEMO-BB-'+String(id).padStart(4,'0'),name:v.name.trim(),contact_number:v.contact,email:v.email||'demo@example.test',event_date:v.eventDate,event_time:v.eventTime,venue:v.venue,city_id:v.cityId,package_name:offer.name,package_id:offer.id,rental_id:model.id,status:'pending',pricing_state:unknown?'pending_quote':'final',subtotal_cents:total,total_cents:unknown?null:total,deposit_cents:unknown?null:Math.ceil(total/2),created_at:stamp(),notes:v.notes||'',selection:[],quote:{model_name:model.name,package_name:offer.name,variant:state.catalog.variants.find(x=>x.id===Number(v.variantId))?.name||'Standard',rental_hours:offer.rental_hours+hours,base_price_cents:offer.base_price_cents,extra_hours:hours,extra_hours_cents:hours*state.policy.extraHourCents,delivery_cents:city.delivery_cents,subtotal_cents:total},expires_at:new Date(Date.now()+3*3600000).toISOString()};
    state.bookings.push(b);return b;
  }
  function route(path,method,v,q) {
    if(path==='/api/staff/session')return {authenticated:signedIn,name:'Demo Admin'};
    if(path==='/api/staff/login'){if(!v.email||!v.password)fail('Enter a demo email and password.');login(true);return {authenticated:true,name:'Demo Admin'};}
    if(path==='/api/staff/logout'){login(false);return {ok:true};}
    if(!signedIn)fail('Sign in to the demo first.',401);
    if(path==='/api/catalog')return state.catalog;
    if(path==='/api/availability/month')return {unavailableDates:[...state.bookings.filter(active).map(b=>({date:b.event_date})),...state.blocks.map(b=>({date:b.event_date}))]};
    const p=path.replace('/api/operator','').split('/').filter(Boolean);
    if(p[0]==='overview'||p[0]==='reports')return overview(q);
    if(p[0]==='audit')return {events:state.audit};
    if(p[0]==='bookings') {
      if(p.length===1){if(method==='POST')return {booking:booking(createBooking(v))};let rows=state.bookings.map(booking).filter(b=>(!q.get('from')||b.event_date>=q.get('from'))&&(!q.get('to')||b.event_date<=q.get('to'))&&(!q.get('status')||b.status===q.get('status'))&&(!q.get('search')||[b.reference,b.name,b.contact_number].join(' ').toLowerCase().includes(q.get('search').toLowerCase())));
        const pay=q.get('payment');rows=rows.filter(b=>!pay||pay==='unpaid'&&b.paid_cents===0||pay==='balance'&&b.balance_cents>0||pay==='paid'&&b.total_cents!=null&&b.balance_cents===0||pay==='pending'&&b.pending_cents>0);
        rows.sort((a,b)=>q.get('sort')==='soonest'?a.event_date.localeCompare(b.event_date):q.get('sort')==='latest'?b.event_date.localeCompare(a.event_date):b.id-a.id);return {bookings:rows.slice(Number(q.get('offset'))||0,(Number(q.get('offset'))||0)+(Number(q.get('limit'))||25)),total:rows.length};}
      const b=findBooking(decodeURIComponent(p[1]));if(p.length===2)return {booking:booking(b)};
      if(p[2]==='quote'){b.total_cents=amount(v.total);b.deposit_cents=Math.ceil(b.total_cents/2);b.pricing_state='final';b.quote.note=v.note||'';}
      else if(p[2]==='status'){if(v.status==='confirmed'){checkDate(b.event_date,b);if(b.total_cents==null||booking(b).paid_cents<b.deposit_cents)fail('Verify at least the demo deposit before confirming.');}if(!['confirmed','cancelled','completed'].includes(v.status))fail('Invalid demo status.');b.status=v.status;}
      else if(p[2]==='reschedule'){checkDate(v.eventDate,b);if(!/^\d{2}:\d{2}$/.test(v.eventTime||''))fail('Choose an event time.');b.event_date=v.eventDate;b.event_time=v.eventTime;b.status='pending';}
      else if(p[2]==='payments'){if(b.total_cents==null)fail('Set a demo quotation first.');const cents=amount(v.amount);if(!v.reference?.trim())fail('Enter a demo transaction reference.');if(state.payments.some(p=>p.reference===v.reference.trim()))fail('That demo reference is already recorded.',409);if(cents>booking(b).balance_cents)fail('Amount exceeds the demo balance.');state.payments.push({id:nextId(state.payments),booking_id:b.id,reference:v.reference.trim(),method:v.method,amount_cents:cents,status:'pending',created_at:stamp()});}
      else fail('Unsupported demo booking action.',404);return {booking:booking(b)};
    }
    if(p[0]==='payments'){const item=state.payments.find(x=>x.id===Number(p[1]));if(!item)fail('Payment not found.',404);if(!['verified','rejected','refunded'].includes(v.status))fail('Invalid payment state.');item.status=v.status;return {payment:item};}
    if(p[0]==='date-blocks'){if(method==='GET')return {blocks:state.blocks};if(p[2]==='remove')state.blocks=state.blocks.filter(x=>x.event_date!==p[1]);else{checkDate(v.date);if(!v.reason?.trim())fail('Enter a reason.');state.blocks.push({event_date:v.date,reason:v.reason});}return {ok:true};}
    if(p[0]==='inquiries'){if(p.length===1)return {inquiries:state.inquiries};const i=state.inquiries.find(x=>x.id===Number(p[1]));if(!i)fail('Inquiry not found.',404);if(p[2]==='reply'){i.reply=v.reply;i.status='replied';return {ok:true};}if(p[2]==='convert'){if(!v.customerAcceptedFee)fail('Acknowledge the demo deposit.');const b=createBooking({...JSON.parse(i.details),name:i.name,contact:i.contact,cityId:'quezon-city',venue:'Demo inquiry venue',notes:'',reservationFeeAccepted:true});i.status='converted';return {booking:booking(b)};}}
    if(p[0]==='catalog') {
      if(p.length===1)return state.catalog;
      const list=state.catalog[p[1]];if(!Array.isArray(list))fail('Demo catalog collection not found.',404);
      let item=list.find(x=>x.id===Number(p[2]));if(!item){if(method!=='POST')fail('Catalog item not found.',404);item={id:nextId(list),is_active:true};list.push(item);}
      if(p[3]==='pricing'){item.base_price_cents=amount(v.price);item.rental_hours=Number(v.hours);item.inclusions=JSON.stringify(v.inclusions||[]);state.catalog.packageModels=state.catalog.packageModels.filter(x=>x.package_id!==item.id).concat((v.modelIds||[]).map(id=>({package_id:item.id,model_id:Number(id)})));}
      else {for(const k of ['name','description'])if(v[k]!==undefined)item[k]=v[k];if(v.active!==undefined)item.is_active=!!v.active;if(v.modelId)item.model_id=Number(v.modelId);if(v.zoneId)item.zone_id=Number(v.zoneId);if(v.capacity)item.capacity=Number(v.capacity);if(v.imageUrl!==undefined)item.image_url=v.imageUrl;if(v.includesBalls!==undefined)item.includes_balls=v.includesBalls;if(v.packageId!==undefined){item.booking_package_id=Number(v.packageId)||null;state.catalog.packageModels=state.catalog.packageModels.filter(x=>x.model_id!==item.id).concat(item.booking_package_id?[{package_id:item.booking_package_id,model_id:item.id}]:[]);}}
      return {ok:true};
    }
    if(p[0]==='pricing-policy'){if(method==='PUT'){for(const k of ['extraHourCents','archCents','backdropCents'])if(!Number.isInteger(Number(v[k]))||Number(v[k])<0)fail('Prices must be nonnegative whole centavos.');state.policy.extraHourCents=Number(v.extraHourCents);state.policy.extras={'Balloon arch':Number(v.archCents),'Backdrop & signage':Number(v.backdropCents)};for(const c of state.policy.cities)c.delivery_cents=Number(v.delivery[c.id]);state.catalog.cities=copy(state.policy.cities);}return state.policy;}
    if(p[0]==='articles'){if(p.length===1)return {articles:state.articles};const slug=decodeURIComponent(p[1]);let a=state.articles.find(x=>x.slug===slug);if(!a){a={slug,blocks:[],provenance:'synthetic-demo',revision:0};state.articles.push(a);}Object.assign(a,{title:v.title,summary:v.summary,category:v.category,date_label:v.dateLabel,image:v.image,image_alt:v.imageAlt,state:v.state,revision:a.revision+1});if(v.body)a.blocks=[{tag:'p',children:[v.body]}];return {article:a};}
    if(p[0]==='reviews'){if(p.length===1)return {reviews:state.reviews};const review=state.reviews.find(x=>x.id===Number(p[1]));if(!review)fail('Review not found.',404);if(p[2]==='editorial')Object.assign(review,{correction:v.correction,featured:!!v.featured,archived:!!v.archived});else review.moderation_status=v.status;return {review};}
    if(p[0]==='business-settings'){if(method==='PUT'){const old=state.settings.payment;state.settings={contact:{name:v.name,email:v.email,phone:v.phone,area:v.area,hours:v.hours},payment:{...old,gcash:v.gcashMode==='disabled'?null:{name:v.gcashName,number:v.gcashNumber},note:v.paymentNote,bank:{businessApproved:false},cash:{businessApproved:!!v.cashApproved,instructions:v.cashInstructions}}};}return {settings:state.settings};}
    if(p[0]==='staff-notices'){if(method==='PUT')state.preferences={...v};return {preferences:state.preferences,notices:[]};}
    if(p[0]==='notifications'){if(p[2]==='retry'){const n=state.notifications.find(n=>n.id===Number(p[1]));if(n)n.status='queued';}return {provider_configured:false,notifications:state.notifications};}
    fail('This operation is not part of the browser demo.',404);
  }
  window.fetch=async (input,init={})=>{
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);
    if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return nativeFetch(input,init);
    const method=String(init.method||input.method||'GET').toUpperCase();
    try {
      if(init.signal?.aborted)throw new DOMException('Aborted','AbortError');
      const v=init.body?JSON.parse(init.body):{};
      const before=method==='GET'?null:copy(state);
      let data;try { data=route(url.pathname,method,v,url.searchParams); }catch(error){if(before)state=before;throw error;}
      if(method!=='GET'){state.audit.push({action:'Demo '+method,entity:url.pathname,created_at:stamp()});save();}
      return new Response(JSON.stringify(copy(data)),{status:200,headers:{'Content-Type':'application/json'}});
    }catch(error){if(error.name==='AbortError')throw error;return new Response(JSON.stringify({error:error.message}),{status:error.status||400,headers:{'Content-Type':'application/json'}});}
  };
  function labelDemo() {
    if(document.body.classList.contains('login-page')){
      document.querySelector('.lead').textContent='Browser demo: enter any valid email and any non-empty password. Synthetic data only.';
      document.querySelector('.login-foot').textContent='Presentation demo — no real staff authentication';
      return;
    }
    const main=document.querySelector('main');if(!main)return;
    const notice=document.createElement('p');notice.className='mu';notice.id='admin-demo-notice';notice.textContent='Demo mode · Synthetic data · Changes are saved only in this browser. ';
    const reset=document.createElement('button');reset.type='button';reset.className='btn';reset.textContent='Reset demo data';reset.addEventListener('click',()=>{if(confirm('Reset only the synthetic Admin data saved in this browser?')){state=seed();save();location.reload();}});notice.append(reset);main.querySelector('.top')?.after(notice);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',labelDemo,{once:true});else labelDemo();
})();
