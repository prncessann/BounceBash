if (!window.BB_CUSTOMER_BROWSER_DEMO) { window.BB_CUSTOMER_BROWSER_DEMO=true;
'use strict';
/* Standalone presentation data. No server, real authentication or transfers.
   Shared synthetic browser demo adapter. No backend connection required. */
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
  
})();

(()=>{const k='bouncebash-admin-demo-v1';const s=JSON.parse(localStorage.getItem(k));if(!s.customerArticlesAdded){const articles=[{"slug": "5-neutral-party-themes-that-photograph-beautifully", "title": "5 neutral party themes that photograph beautifully", "summary": "Soft, warm palettes that look good in every photo, from the first balloon to the last slice of cake.", "category": "Styling", "date_label": "Sep 2026 | 3 min read | By the Bounce Bash PH team", "image": "../assets/photos/styled-cake-table-dried-florals.jpg", "image_alt": "Styled cake table with dried florals", "blocks": ["\n    ", {"tag": "p", "attrs": {}, "children": ["Neutral parties photograph well because nothing fights for attention. Here are five palettes we love, all easy to build with our ball colors and balloon add-ons."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["1. Classic White"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["All-white castle, white balls and a clean garland. Timeless, and it works for any age or occasion."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["2. Cream & Champagne"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Warm and gently glowing, especially in late-afternoon light. Pair it with a gold arch backdrop."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["3. Boho Blush"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Blush and cream with dried florals on the cake table. Our Boho Pastel Playground style is made for this."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["4. Sage Garden"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Soft sage balloons look beautiful outdoors against greenery."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["5. Mocha & Cream"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Earthy and modern. Mocha balls add depth to an otherwise pale setup."]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Choose ball colors on the ", {"tag": "a", "attrs": {"href": "add-ons.html"}, "children": ["add-ons page"]}, ", then see these looks in our ", {"tag": "a", "attrs": {"href": "gallery.html"}, "children": ["gallery"]}, "."]}, "\n    ", {"tag": "div", "attrs": {"class": "post-cta card hoverable"}, "children": ["\n      ", {"tag": "h3", "attrs": {}, "children": ["Ready to plan your party?"]}, "\n      ", {"tag": "p", "attrs": {"class": "muted"}, "children": ["Check your date and reserve with a 50% reservation fee."]}, "\n      ", {"tag": "div", "attrs": {"class": "button-row"}, "children": [{"tag": "a", "attrs": {"class": "btn btn-dark", "href": "calendar.html"}, "children": ["Check Availability"]}, {"tag": "a", "attrs": {"class": "btn btn-outline", "href": "packages.html"}, "children": ["View Packages"]}]}, "\n    "]}, "\n  "], "position": 2}, {"slug": "a-day-with-our-delivery-and-setup-crew", "title": "A day with our delivery and setup crew", "summary": "Follow a typical event day, from loading the truck to the last pick-up.", "category": "Behind the scenes", "date_label": "Aug 2026 | 3 min read | By the Bounce Bash PH team", "image": "../assets/photos/balloon-garland-sage.jpg", "image_alt": "Sage balloon garland setup", "blocks": ["\n    ", {"tag": "p", "attrs": {}, "children": ["Parties look effortless because a lot happens before guests arrive. Here is a typical day."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["Morning: load and inspect"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["The crew loads the inflatable, ball pit, balls and balloon décor, and checks everything against your booking."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["Arrival: setup"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["We arrive ahead of your start time to set up, style the balloons and check the play area."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["Party time: supervision"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Our team stays on site to supervise the play area while you enjoy your guests."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["After: pick-up"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Once the party wraps up, we deflate, pack and pick everything up, so you do not have to clean up the bounce house."]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Delivery, setup and pick-up are part of every rental."]}, "\n    ", {"tag": "div", "attrs": {"class": "post-cta card hoverable"}, "children": ["\n      ", {"tag": "h3", "attrs": {}, "children": ["Ready to plan your party?"]}, "\n      ", {"tag": "p", "attrs": {"class": "muted"}, "children": ["Check your date and reserve with a 50% reservation fee."]}, "\n      ", {"tag": "div", "attrs": {"class": "button-row"}, "children": [{"tag": "a", "attrs": {"class": "btn btn-dark", "href": "calendar.html"}, "children": ["Check Availability"]}, {"tag": "a", "attrs": {"class": "btn btn-outline", "href": "packages.html"}, "children": ["View Packages"]}]}, "\n    "]}, "\n  "], "position": 5}, {"slug": "ball-pit-color-combinations-that-always-look-good", "title": "Ball pit color combinations that always look good", "summary": "Mix up to three colors from our palette. Here are combinations that work every time.", "category": "Styling", "date_label": "Jul 2026 | 3 min read | By the Bounce Bash PH team", "image": "../assets/photos/kids-in-ball-pit-pastel.jpg", "image_alt": "Kids playing in a pastel ball pit", "blocks": ["\n    ", {"tag": "p", "attrs": {}, "children": ["You can mix up to three ball colors per ball pit. Our palette: White, Cream, Champagne, Blush, Sage, Mocha, Sky and Lavender."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["Soft & Dreamy"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Blush, Cream and White. A gentle choice for a girls' birthday or a christening."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["Garden Party"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Sage, Cream and Champagne. Looks lovely outdoors."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["Boho Earth"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Mocha, Cream and Blush. Warm and photo-ready."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["Cool Skies"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Sky, White and Lavender. Fresh and calm, great for boys' parties."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["Tip"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Pick one main color and use the others as accents. Match the balls to your balloon garland and cake table, and the whole setup feels planned."]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Choose your colors on the ", {"tag": "a", "attrs": {"href": "add-ons.html"}, "children": ["add-ons page"]}, "."]}, "\n    ", {"tag": "div", "attrs": {"class": "post-cta card hoverable"}, "children": ["\n      ", {"tag": "h3", "attrs": {}, "children": ["Ready to plan your party?"]}, "\n      ", {"tag": "p", "attrs": {"class": "muted"}, "children": ["Check your date and reserve with a 50% reservation fee."]}, "\n      ", {"tag": "div", "attrs": {"class": "button-row"}, "children": [{"tag": "a", "attrs": {"class": "btn btn-dark", "href": "calendar.html"}, "children": ["Check Availability"]}, {"tag": "a", "attrs": {"class": "btn btn-outline", "href": "packages.html"}, "children": ["View Packages"]}]}, "\n    "]}, "\n  "], "position": 6}, {"slug": "complete-guide-stress-free-kids-party", "title": "The complete guide to planning a stress-free kids' party", "summary": "From choosing a package to picking ball colors, here is everything to sort out before your event date.", "category": "Featured", "date_label": "Oct 2026 | 6 min read | By the Bounce Bash PH team", "image": "../assets/photos/bounce-house-balloon-arch-ballpit.jpg", "image_alt": "Bounce house with balloon arch and ball pit", "blocks": ["\n    ", {"tag": "p", "attrs": {}, "children": ["A good kids' party is mostly decided weeks before the day itself. Work through these steps in order and the day will feel calm, even with a full guest list."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["1. Start with the date"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Open our ", {"tag": "a", "attrs": {"href": "calendar.html"}, "children": ["availability calendar"]}, " first. Available dates can be requested; submitted and confirmed bookings are shown as unavailable. Weekends fill quickly, so have a second date in mind."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["2. Match the package to your guest list"]}, "\n    ", {"tag": "p", "attrs": {}, "children": [{"tag": "strong", "attrs": {}, "children": ["Little Bounce"]}, " (PHP 4,500) is a single bounce house for a smaller celebration. ", {"tag": "strong", "attrs": {}, "children": ["Ball Pit Bash"]}, " (PHP 5,500) suits toddlers. ", {"tag": "strong", "attrs": {}, "children": ["Bash & Bounce"]}, " (PHP 8,500) pairs a bounce house with a ball pit for a fuller party, and ", {"tag": "strong", "attrs": {}, "children": ["The Luxe Bash"]}, " (PHP 12,500) adds balloon décor. See all of them on the ", {"tag": "a", "attrs": {"href": "packages.html"}, "children": ["packages page"]}, "."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["3. Choose your look"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Pick between soft and aesthetic or bright and colorful on our , then choose ball colors from the add-ons palette: White, Cream, Champagne, Blush, Sage, Mocha, Sky or Lavender. You can mix up to three."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["4. Add the photo-ready extras"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Choose an optional balloon arch (+PHP 400 per arch) or backdrop (+PHP 800). Ball-color selection is included with eligible rentals."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["5. Reserve and relax"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Submit your booking request and pay the 50% reservation fee to secure the date. We confirm within 24 hours, then deliver, set up and supervise on the day."]}, "\n    ", {"tag": "ul", "attrs": {"class": "good-list article-list"}, "children": [{"tag": "li", "attrs": {}, "children": ["Check the date and the space at your venue"]}, {"tag": "li", "attrs": {}, "children": ["Choose a package and a style"]}, {"tag": "li", "attrs": {}, "children": ["Pick ball colors and add-ons"]}, {"tag": "li", "attrs": {}, "children": ["Send your booking request"]}, {"tag": "li", "attrs": {}, "children": ["Pay the 50% reservation fee"]}]}, "\n    ", {"tag": "div", "attrs": {"class": "post-cta card hoverable"}, "children": ["\n      ", {"tag": "h3", "attrs": {}, "children": ["Ready to plan your party?"]}, "\n      ", {"tag": "p", "attrs": {"class": "muted"}, "children": ["Check your date and reserve with a 50% reservation fee."]}, "\n      ", {"tag": "div", "attrs": {"class": "button-row"}, "children": [{"tag": "a", "attrs": {"class": "btn btn-dark", "href": "calendar.html"}, "children": ["Check Availability"]}, {"tag": "a", "attrs": {"class": "btn btn-outline", "href": "packages.html"}, "children": ["View Packages"]}]}, "\n    "]}, "\n  "], "position": 0}, {"slug": "indoor-or-outdoor-choosing-the-best-space", "title": "Indoor or outdoor? Choosing the best space for your bounce house", "summary": "Both work. Here is how to decide, and what to check before you book.", "category": "Party tips", "date_label": "Aug 2026 | 4 min read | By the Bounce Bash PH team", "image": "../assets/photos/kids-splash-slide-palm-trees.jpg", "image_alt": "Kids on a splash slide beside palm trees", "blocks": ["\n    ", {"tag": "p", "attrs": {}, "children": ["Our Dry Zone inflatables are made for year-round indoor or outdoor events, so the right choice comes down to your space."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["Outdoors"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Gardens, driveways and open courtyards give you the most room. In the Philippines, shade matters, so a covered area or an afternoon slot keeps kids comfortable. The Splash Zone is made for hot days outdoors."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["Indoors"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Function halls and large clubhouses are a great rainy-season option. Measure the doorways and the ceiling height, and let us know the layout."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["Checklist"]}, "\n    ", {"tag": "ul", "attrs": {"class": "good-list article-list"}, "children": [{"tag": "li", "attrs": {}, "children": ["Flat ground or floor"]}, {"tag": "li", "attrs": {}, "children": ["Enough clearance on all sides"]}, {"tag": "li", "attrs": {}, "children": ["A way to bring the equipment in"]}, {"tag": "li", "attrs": {}, "children": ["Access to power for the blower"]}, {"tag": "li", "attrs": {}, "children": ["Shade, if outdoors"]}]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Delivery charges depend on your venue, so ask us when you ", {"tag": "a", "attrs": {"href": "calendar.html"}, "children": ["check availability"]}, "."]}, "\n    ", {"tag": "div", "attrs": {"class": "post-cta card hoverable"}, "children": ["\n      ", {"tag": "h3", "attrs": {}, "children": ["Ready to plan your party?"]}, "\n      ", {"tag": "p", "attrs": {"class": "muted"}, "children": ["Check your date and reserve with a 50% reservation fee."]}, "\n      ", {"tag": "div", "attrs": {"class": "button-row"}, "children": [{"tag": "a", "attrs": {"class": "btn btn-dark", "href": "calendar.html"}, "children": ["Check Availability"]}, {"tag": "a", "attrs": {"class": "btn btn-outline", "href": "packages.html"}, "children": ["View Packages"]}]}, "\n    "]}, "\n  "], "position": 4}, {"slug": "our-setup-checklist-before-the-first-bounce", "title": "Our setup checklist: what happens before the first bounce", "summary": "A look at what our crew does on arrival, so you know every party starts safe.", "category": "Safety", "date_label": "Sep 2026 | 5 min read | By the Bounce Bash PH team", "image": "../assets/photos/bounce-house-garden-kids.jpg", "image_alt": "Bounce house set up in a garden", "blocks": ["\n    ", {"tag": "p", "attrs": {}, "children": ["Safety is the first thing we set up. Here is the routine our crew follows at every event."]}, "\n    ", {"tag": "ul", "attrs": {"class": "good-list article-list"}, "children": [{"tag": "li", "attrs": {}, "children": ["Walk the space and choose a flat, clear spot"]}, {"tag": "li", "attrs": {}, "children": ["Clear the ground of sharp objects and debris"]}, {"tag": "li", "attrs": {}, "children": ["Lay down protective ground sheets"]}, {"tag": "li", "attrs": {}, "children": ["Set up and secure the inflatable"]}, {"tag": "li", "attrs": {}, "children": ["Inflate and check that it is firm and stable"]}, {"tag": "li", "attrs": {}, "children": ["Wipe down and set up the ball pit and décor"]}, {"tag": "li", "attrs": {}, "children": ["Brief the host on the play rules"]}]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["Why we inspect"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["All our equipment is cleaned and inspected before it leaves us. Our crew checks it again on site."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["On-site supervision"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Every rental includes on-site supervision, so you can enjoy the party while we keep an eye on the play area."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["What you can do"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Share your venue details when you book, including whether the space is indoor or outdoor and where power is available. Read more in our ", {"tag": "a", "attrs": {"href": "faq.html"}, "children": ["FAQ"]}, "."]}, "\n    ", {"tag": "div", "attrs": {"class": "post-cta card hoverable"}, "children": ["\n      ", {"tag": "h3", "attrs": {}, "children": ["Ready to plan your party?"]}, "\n      ", {"tag": "p", "attrs": {"class": "muted"}, "children": ["Check your date and reserve with a 50% reservation fee."]}, "\n      ", {"tag": "div", "attrs": {"class": "button-row"}, "children": [{"tag": "a", "attrs": {"class": "btn btn-dark", "href": "calendar.html"}, "children": ["Check Availability"]}, {"tag": "a", "attrs": {"class": "btn btn-outline", "href": "packages.html"}, "children": ["View Packages"]}]}, "\n    "]}, "\n  "], "position": 3}, {"slug": "pick-the-right-inflatable-for-your-guest-list", "title": "How to pick the right inflatable for your guest list", "summary": "Guest count, ages and space all point to one setup. Here is how to read them.", "category": "Party tips", "date_label": "Oct 2026 | 4 min read | By the Bounce Bash PH team", "image": "../assets/photos/child-playing-cream-bounce-house.jpg", "image_alt": "Child playing in a cream bounce house", "blocks": ["\n    ", {"tag": "p", "attrs": {}, "children": ["Choosing an inflatable is easier when you start from who is coming, not from what looks biggest."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["Count the kids, not the guests"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Only the children will be bouncing at any one time. Our styles list a suggested number of kids, for example up to 10 or up to 12, so use your child guest count rather than total headcount."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["Think about ages"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Toddlers do best with a ball pit, which is why ", {"tag": "a", "attrs": {"href": "packages.html"}, "children": ["Ball Pit Bash"]}, " exists. Our Dry Zone styles are listed for ages 2 to 10 or 3 to 12, so check the age range against your group."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["Mix zones for mixed ages"]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["A bounce house and ball pit together, like ", {"tag": "strong", "attrs": {}, "children": ["Bash & Bounce"]}, ", gives bigger kids something to climb and bounce on while little ones stay in the ball pit. Browse the three ", {"tag": "a", "attrs": {"href": "rentals.html"}, "children": ["play zones"]}, " to see what fits."]}, "\n    ", {"tag": "h2", "attrs": {}, "children": ["Rule of thumb"]}, "\n    ", {"tag": "ul", "attrs": {"class": "good-list article-list"}, "children": [{"tag": "li", "attrs": {}, "children": ["Under 10 kids, mostly toddlers: Ball Pit Bash"]}, {"tag": "li", "attrs": {}, "children": ["Smaller party, school-age kids: Little Bounce"]}, {"tag": "li", "attrs": {}, "children": ["Wide age range or a fuller party: Bash & Bounce"]}, {"tag": "li", "attrs": {}, "children": ["Want it all styled: The Luxe Bash"]}]}, "\n    ", {"tag": "p", "attrs": {}, "children": ["Still unsure? Send an inquiry from the ", {"tag": "a", "attrs": {"href": "booking.html"}, "children": ["booking page"]}, " and we will help you pick."]}, "\n    ", {"tag": "div", "attrs": {"class": "post-cta card hoverable"}, "children": ["\n      ", {"tag": "h3", "attrs": {}, "children": ["Ready to plan your party?"]}, "\n      ", {"tag": "p", "attrs": {"class": "muted"}, "children": ["Check your date and reserve with a 50% reservation fee."]}, "\n      ", {"tag": "div", "attrs": {"class": "button-row"}, "children": [{"tag": "a", "attrs": {"class": "btn btn-dark", "href": "calendar.html"}, "children": ["Check Availability"]}, {"tag": "a", "attrs": {"class": "btn btn-outline", "href": "packages.html"}, "children": ["View Packages"]}]}, "\n    "]}, "\n  "], "position": 1}];for(const a of articles)if(!s.articles.some(x=>x.slug===a.slug))s.articles.push({...a,state:'published',revision:1,provenance:'bundled-demo'});s.customerArticlesAdded=true;localStorage.setItem(k,JSON.stringify(s));}})();
'use strict';
/* Customer browser demo. State is shared with the synthetic Admin demo only. */
(() => {
 const KEY='bouncebash-admin-demo-v1',SESSION=KEY+'-customer',prior=window.fetch.bind(window),root=new URL('.',document.currentScript.src);
 const clone=x=>JSON.parse(JSON.stringify(x));
 const read=()=>{const s=JSON.parse(localStorage.getItem(KEY));s.customers||=[];return s;};
 const save=s=>localStorage.setItem(KEY,JSON.stringify(s));
 const now=()=>new Date().toISOString(),stamp=()=>now().slice(0,19).replace('T',' ');
 const bad=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
 const id=list=>Math.max(0,...list.map(x=>Number(x.id)||0))+1;
 const who=s=>s.customers.find(u=>u.id===Number(sessionStorage.getItem(SESSION)));
 const requireUser=s=>{const u=who(s);if(!u)bad('Sign in to the customer demo first.',401);return u;};
 const active=b=>['pending','confirmed'].includes(b.status);
 function available(s,date,except){return !s.blocks.some(b=>b.event_date===date)&&!s.bookings.some(b=>b!==except&&active(b)&&b.event_date===date);}
 function enriched(s,b){const payments=s.payments.filter(p=>p.booking_id===b.id);const paid=payments.filter(p=>p.status==='verified').reduce((a,p)=>a+p.amount_cents,0);return {...b,reference_code:b.reference,payments,paid_cents:paid,balance_cents:b.total_cents==null?null:Math.max(0,b.total_cents-paid),server_time:now(),quote:b.quote||{}};}
 function catalog(s){const c=clone(s.catalog);c.models=c.models.filter(m=>m.is_active).map(m=>({...m,image_url:new URL('assets/photos/'+m.image_url.split('/').pop(),root).href}));c.packages=c.packages.filter(p=>p.is_active);c.variants=c.variants.filter(v=>v.is_active);c.cities=s.policy.cities;c.colors=['White','Cream','Pink','Blue','Yellow','Green','Purple','Gold'];c.backdropEvents=['Birthday','Christening','Baby shower','Graduation','School event','Corporate event','Other'];c.extra_hour_cents=s.policy.extraHourCents;for(const x of c.addOns){if(x.name!=='Ball colors')x.unit_price_cents=s.policy.extras[x.name];}c.zones=c.zones.map(z=>({...z,slug:z.id===1?'dry':z.id===2?'splash':'ball-pit'}));return c;}
 function quote(s,v){const c=catalog(s),m=c.models.find(x=>x.id===Number(v.rentalId)),p=m&&c.packages.find(p=>p.id===m.booking_package_id),city=c.cities.find(x=>x.id===v.cityId);if(!p||!city)bad('Choose a rental and delivery location.');const hours=Number(v.extraHours)||0;if(!Number.isInteger(hours)||hours<0||hours>12)bad('Choose valid additional hours.');const add_ons=(v.addOnItems||[]).map(a=>{if(!['Ball colors','Balloon arch','Backdrop & signage'].includes(a.name))bad('Invalid add-on.');const quantity=a.name==='Balloon arch'?Number(a.quantity):1;if(!Number.isInteger(quantity)||quantity<1||quantity>20)bad('Choose a valid arch quantity.');if(a.name==='Balloon arch'&&(!a.colors?.length||a.colors.length>3||new Set(a.colors).size!==a.colors.length))bad('Choose one to three distinct colors.');if(a.name==='Backdrop & signage'&&a.eventType==='Other'&&!a.otherEvent?.trim())bad('Describe the backdrop event.');return {...a,quantity,unit_price_cents:a.name==='Ball colors'?0:s.policy.extras[a.name]};});const subtotal=p.base_price_cents+hours*s.policy.extraHourCents+city.delivery_cents+add_ons.reduce((n,a)=>n+a.quantity*a.unit_price_cents,0),pending=!!v.notes?.trim();return {model_name:m.name,package_name:p.name,variant:c.variants.find(x=>x.id===Number(v.variantId))?.name||'Standard',included_hours:p.rental_hours,rental_hours:p.rental_hours+hours,base_price_cents:p.base_price_cents,extra_hours:hours,extra_hours_cents:hours*s.policy.extraHourCents,city_name:city.name,delivery_cents:city.delivery_cents,add_ons,subtotal_cents:subtotal,total_cents:pending?null:subtotal,deposit_cents:pending?null:Math.ceil(subtotal/2),pricing_state:pending?'pending_quote':'final',review_token:'browser-demo-review'};}
 function route(s,path,method,v,q){
  const user=who(s),message='Saved in this browser demo only.';
  if(path==='/api/catalog')return catalog(s);
  if(path==='/api/auth/session')return {authenticated:!!user,user:user||null};
  if(['/api/auth/login','/api/auth/signup'].includes(path)){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email||'')||!v.password)bad('Enter a valid demo email and a non-empty password.');let u=s.customers.find(u=>u.email===v.email.trim().toLowerCase());if(!u){u={id:id(s.customers),name:v.name||'Demo Customer',email:v.email.trim().toLowerCase(),phone:'00000000000',city:'Quezon City',address:'Demo venue',email_verified:true,created_at:now()};s.customers.push(u);}sessionStorage.setItem(SESSION,String(u.id));return {authenticated:true,user:u,message:'Signed in to the browser demo. No real authentication is performed.'};}
  if(path==='/api/auth/logout'){sessionStorage.removeItem(SESSION);return {message};}
  if(path==='/api/business-settings')return {settings:{...s.settings,payment:{gcash:{name:'DEMO ONLY — do not send money',number:'00000000000'},bank:{businessApproved:false},cash:{businessApproved:false},note:'Browser demo only. Use a fictional transaction reference; do not transfer money.'}}};
  if(path==='/api/availability')return {available:available(s,q.get('date'))};
  if(path==='/api/availability/month')return {unavailableDates:[...s.bookings.filter(active).map(b=>({date:b.event_date,status:'unavailable'})),...s.blocks.map(b=>({date:b.event_date,status:'blocked'}))]};
  if(path==='/api/quotes')return {quote:quote(s,v)};
  if(path==='/api/customers/me'){const u=requireUser(s);if(method==='PUT')for(const k of ['name','phone','city','address'])if(v[k]!==undefined)u[k]=v[k];return {user:u,message};}
  if(path==='/api/customers/email'){const u=requireUser(s);u.email=v.email;return {user:u,message};}
  if(path==='/api/customers/password'){requireUser(s);return {message:'Demo password form checked. No real password is stored.'};}
  if(path.startsWith('/api/auth/'))return {message:'This is a browser demonstration. No email is sent.'};
  if(path==='/api/newsletter'||path==='/api/newsletter/unsubscribe')return {message:'Demo newsletter preference recorded. No email is sent.'};
  if(path==='/api/inquiries/mine'){const u=requireUser(s);if(method==='POST')s.inquiries.push({id:id(s.inquiries),customer_id:u.id,name:v.name||u.name,contact:v.contact||u.phone,status:'new',reply:'',details:JSON.stringify({...v,packageName:quote(s,v).package_name})});return {inquiries:s.inquiries.filter(i=>i.customer_id===u.id),message};}
  if(path==='/api/bookings/mine'){const u=requireUser(s);return {bookings:s.bookings.filter(b=>b.customer_id===u.id).map(b=>enriched(s,b))};}
  if(path==='/api/bookings'&&method==='POST'){const u=requireUser(s);if(!v.reservationFeeAccepted)bad('Acknowledge the deposit policy.');if(!available(s,v.eventDate))bad('This date is unavailable in the demo.',409);if(new Date(v.eventDate+'T'+v.eventTime+':00+08:00')<=new Date())bad('Choose a future event date.');const x=quote(s,v),n=id(s.bookings),b={id:n,customer_id:u.id,reference:'DEMO-BB-'+String(n).padStart(4,'0'),name:v.name||u.name,email:u.email,contact_number:v.contact,event_date:v.eventDate,event_time:v.eventTime,venue:v.venue,city_id:v.cityId,notes:v.notes||'',package_name:x.package_name,rental_id:Number(v.rentalId),selected_style:x.variant,status:'pending',pricing_state:x.pricing_state,subtotal_cents:x.subtotal_cents,total_cents:x.total_cents,deposit_cents:x.deposit_cents,selection:x.add_ons,quote:x,created_at:stamp(),expires_at:new Date(Date.now()+10800000).toISOString()};s.bookings.push(b);return {booking:enriched(s,b),message:'Demo booking saved. View it in your profile.'};}
  if(path.startsWith('/api/bookings/')){const u=requireUser(s),parts=path.split('/'),b=s.bookings.find(b=>b.reference===decodeURIComponent(parts[3])&&b.customer_id===u.id);if(!b)bad('Demo booking not found for this customer.',404);const action=parts[4];if(action==='cancel')b.status='cancelled';else if(action==='reschedule'){if(!available(s,v.eventDate,b))bad('That date is unavailable.',409);b.event_date=v.eventDate;b.event_time=v.eventTime;b.status='pending';b.expires_at=new Date(Date.now()+10800000).toISOString();}else if(action==='payments'){const n=Number(v.amount),balance=enriched(s,b).balance_cents;if(b.total_cents==null||!Number.isFinite(n)||n<=0||Math.round(n*100)>balance)bad('Enter a valid amount within the demo balance.');if(!v.reference?.trim()||s.payments.some(p=>p.reference===v.reference.trim()))bad('Enter a unique fictional reference.');s.payments.push({id:id(s.payments),booking_id:b.id,reference:v.reference.trim(),method:v.method,amount_cents:Math.round(n*100),status:'pending',created_at:stamp()});}return {booking:enriched(s,b),message:'Demo change saved. Payment references await demo staff verification.'};}
  if(path==='/api/reviews'){if(method==='POST'){const u=requireUser(s);s.reviews.push({id:id(s.reviews),name:u.name,message:v.message,rating:Number(v.rating)||5,event_type:v.eventType||'',can_feature:!!v.canFeature,moderation_status:'pending',featured:false,archived:false});return {message:'Demo feedback saved for moderation.'};}let rows=s.reviews.filter(r=>r.moderation_status==='approved'&&r.can_feature&&!r.archived);if(q.get('featured'))rows=rows.filter(r=>r.featured);if(q.get('rating'))rows=rows.filter(r=>r.rating===Number(q.get('rating')));const counts={1:0,2:0,3:0,4:0,5:0};rows.forEach(r=>counts[r.rating]++);return {reviews:rows.slice(Number(q.get('offset'))||0,(Number(q.get('offset'))||0)+(Number(q.get('limit'))||6)),total:rows.length,summary:{count:rows.length,total:rows.length,distribution:counts,average:rows.length?rows.reduce((a,r)=>a+r.rating,0)/rows.length:0,counts}};}
  if(path.startsWith('/api/articles')){const rows=s.articles.filter(a=>a.state==='published').map(a=>({...a,url:a.slug+'.html'}));if(path==='/api/articles')return {articles:rows};const a=rows.find(a=>a.slug===decodeURIComponent(path.split('/').pop()));if(!a)bad('This demo article is unavailable.',404);return {article:a};}
  bad('This action is not part of the customer browser demo.',404);
 }
 window.fetch=async(input,init={})=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);if(url.origin!==location.origin||!url.pathname.startsWith('/api/')||url.pathname.startsWith('/api/operator/')||url.pathname.startsWith('/api/staff/'))return prior(input,init);try{const s=read(),method=String(init.method||'GET').toUpperCase(),v=init.body?JSON.parse(init.body):{},result=route(s,url.pathname,method,v,url.searchParams);save(s);return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});}catch(e){return new Response(JSON.stringify({error:e.message}),{status:e.status||400,headers:{'Content-Type':'application/json'}});}};
 document.addEventListener('DOMContentLoaded',()=>{const p=document.createElement('p');p.className='small muted';p.textContent='Browser demo — fictional data only. Demo sign-in accepts any valid email and non-empty password. Do not enter real payment details.';p.style.textAlign='center';document.querySelector('main')?.prepend(p);},{once:true});
})();


}
let refreshPublicReviews = null;

document.addEventListener('DOMContentLoaded', () => {
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm && bookingForm.dataset.wizard !== 'true') {
    console.error('Use the current booking wizard.');
  }

  const feedbackForm = document.getElementById('feedback-form');
  if (feedbackForm) {
    initFeedbackForm(feedbackForm);
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    initLoginForm(loginForm);
  }

  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    initSignupForm(signupForm);
  }

  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    initProfileForm(profileForm);
  }

  const passwordForm = document.getElementById('password-form');
  if (passwordForm) {
    initPasswordForm(passwordForm);
  }

  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    initNewsletterForm(newsletterForm);
  }

  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    initLogout(logoutLink);
  }

  if (document.getElementById('availability-calendar')) {
    initAvailabilityCalendar();
  }

  if (document.getElementById('mini-calendar')) {
    renderMiniCalendar('mini-calendar', 'mini-calendar-month', 'mini-calendar-message');
  }

  if (document.getElementById('booking-mini-calendar')) {
    renderMiniCalendar('booking-mini-calendar', 'booking-mini-calendar-month', 'booking-mini-calendar-message');
  }

  if (document.getElementById('reviews-grid')) {
    initReviews();
  }

  if (document.getElementById('home-testimonials')) {
    initHomepageReviews();
  }

  const returnTo=new URLSearchParams(location.search).get('next');
  if(returnTo&&safeAuthReturn()!=='profile.html')document.querySelectorAll('a[href="login.html"],a[href="signup.html"]').forEach(a=>{a.href=a.getAttribute('href')+'?next='+encodeURIComponent(returnTo);});
  initPackageBookingLinks();
  initSessionState();
});

async function apiRequest(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.');
  }
  return payload;
}

function setStatus(element, message, isError = false) {
  if (!element) return;
  element.textContent = message || '';
  element.dataset.state = isError ? 'error' : 'success';
}

async function initFeedbackForm(form) {
  const feedbackMessage = document.getElementById('feedback-message');
  apiRequest('/api/catalog').then(data=>{const select=document.getElementById('fb-pkg');if(select){const chosen=select.value;select.replaceChildren(new Option('Select rental',''),...data.packages.map(p=>new Option(p.name.replace(/ — Demo rental$/,''),p.name)));select.value=chosen;}}).catch(()=>{});
  const submitButton = form.querySelector('button[type="submit"]');
  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    if (submitButton) submitButton.disabled = true;
    const payload = {
      name: document.getElementById('fb-name')?.value,
      eventType: document.getElementById('fb-event')?.value,
      packageName: document.getElementById('fb-pkg')?.value,
      rating: document.getElementById('fb-rating')?.value || 5,
      message: document.getElementById('fb-text')?.value,
      canFeature: document.getElementById('share-publicly')?.checked || false,
    };

    try {
      setStatus(feedbackMessage, 'Submitting your feedback...', false);
      const result = await apiRequest('/api/reviews', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStatus(feedbackMessage, result.message, false);
      form.reset();
      if (refreshPublicReviews) await refreshPublicReviews();
    } catch (error) {
      setStatus(feedbackMessage, error.message, true);
    } finally {
      submitting = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}

async function initLoginForm(form) {
  const authMessage = document.getElementById('login-message') || document.getElementById('auth-message');
  const submitButton = form.querySelector('button[type="submit"]');
  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    if (submitButton) submitButton.disabled = true;
    const payload = {
      email: form.querySelector('input[name="email"]')?.value,
      password: form.querySelector('input[name="password"]')?.value,
    };

    try {
      setStatus(authMessage, 'Logging in...', false);
      const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStatus(authMessage, result.message, false);
      setTimeout(() => {
        window.location.href = safeAuthReturn();
      }, 600);
    } catch (error) {
      setStatus(authMessage, error.message, true);
    } finally {
      submitting = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}

async function initSignupForm(form) {
  const authMessage = document.getElementById('signup-message') || document.getElementById('auth-message');
  const submitButton = form.querySelector('button[type="submit"]');
  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    if (submitButton) submitButton.disabled = true;
    const payload = {
      name: form.querySelector('input[name="name"]')?.value,
      email: form.querySelector('input[name="email"]')?.value,
      password: form.querySelector('input[name="password"]')?.value,
    };

    try {
      setStatus(authMessage, 'Creating your account...', false);
      const result = await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStatus(authMessage, result.message, false);
      setTimeout(() => {
        window.location.href = safeAuthReturn();
      }, 600);
    } catch (error) {
      setStatus(authMessage, error.message, true);
    } finally {
      submitting = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}

async function initProfileForm(form) {
  const profileMessage = document.getElementById('profile-message');
  const submitButton = form.querySelector('button[type="submit"]');
  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    if (submitButton) submitButton.disabled = true;
    const payload = {
      name: document.getElementById('profile-name')?.value,
      email: document.getElementById('profile-email')?.value,
      phone: document.getElementById('profile-phone')?.value,
      city: document.getElementById('profile-city')?.value,
      address: document.getElementById('profile-address')?.value,
    };

    try {
      setStatus(profileMessage, 'Saving changes...', false);
      const result = await apiRequest('/api/customers/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setStatus(profileMessage, result.message, false);
      const summaryName = document.querySelector('.profile-summary-name');
      const summaryMeta = document.querySelector('.profile-summary-meta');
      if (summaryName) summaryName.textContent = result.user.name;
      if (summaryMeta) summaryMeta.textContent = `${result.user.email} | Member since ${new Date(result.user.created_at).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}`;
    } catch (error) {
      setStatus(profileMessage, error.message, true);
    } finally {
      submitting = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}

async function initPasswordForm(form) {
  const profileMessage = document.getElementById('password-message');
  const submitButton = form.querySelector('button[type="submit"]');
  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    if (submitButton) submitButton.disabled = true;
    const payload = {
      current: document.getElementById('current-password')?.value,
      new: document.getElementById('new-password')?.value,
    };

    try {
      setStatus(profileMessage, 'Updating password...', false);
      const result = await apiRequest('/api/customers/password', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setStatus(profileMessage, result.message, false);
      form.reset();
    } catch (error) {
      setStatus(profileMessage, error.message, true);
    } finally {
      submitting = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}

async function initNewsletterForm(form) {
  const newsletterMessage = document.getElementById('newsletter-message');
  const submitButton = form.querySelector('button[type="submit"]');
  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    if (submitButton) submitButton.disabled = true;
    const email = form.querySelector('input[type="email"]')?.value;
    try {
      setStatus(newsletterMessage, 'Subscribing...', false);
      const result = await apiRequest('/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setStatus(newsletterMessage, result.message, false);
      form.reset();
    } catch (error) {
      setStatus(newsletterMessage, error.message, true);
    } finally {
      submitting = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}

async function initLogout(link) {
  link.addEventListener('click', async (event) => {
    event.preventDefault();
    if (link.getAttribute('aria-disabled') === 'true') return;
    link.setAttribute('aria-disabled', 'true');
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', body: '{}' });
      window.location.replace('index.html');
    } catch (error) {
      link.removeAttribute('aria-disabled');
      const message = document.getElementById('logout-message');
      setStatus(message, error.message, true);
    }
  });
}

async function initAvailabilityCalendar() {
  const monthLabel = document.getElementById('calendar-month');
  const daysBody = document.getElementById('availability-days');
  const statusMessage = document.getElementById('calendar-message');
  const selectedLabel = document.getElementById('selected-date-label');
  const selectedStatus = document.getElementById('selected-date-status');
  const bookingLink = document.getElementById('book-selected-date');
  const styleLabel = document.getElementById('availability-style');
  const previous = document.getElementById('calendar-previous');
  const next = document.getElementById('calendar-next');
  const monthCursor = new Date();
  monthCursor.setDate(1);
  let selectedDate = '';
  let unavailable = new Map();
  let requestSequence=0;
  const requestedStyle = new URLSearchParams(window.location.search).get('style');
  const validStyles = ['Classic White Castle', 'Boho Pastel Playground', 'Rainbow Racer Slide', 'Carnival Pop Castle'];
  const selectedStyle = validStyles.includes(requestedStyle) ? requestedStyle : '';
  styleLabel.textContent = selectedStyle || 'All rentals';

  const render = async () => {
    const sequence=++requestSequence;
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    monthLabel.textContent = monthCursor.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
    daysBody.replaceChildren();
    setStatus(statusMessage, 'Checking date requests...', false);

    try {
      const data = await apiRequest(`/api/availability/month?year=${year}&month=${month + 1}`);
      if(sequence!==requestSequence)return;
      unavailable = new Map(data.unavailableDates.map((item) => [item.date, item.status]));
      setStatus(statusMessage, '', false);
    } catch (error) {
      if(sequence!==requestSequence)return;
      unavailable = new Map();
      setStatus(statusMessage, `Availability could not be loaded: ${error.message}`, true);
      return;
    }

    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let row = document.createElement('tr');

    const addEmptyCell = () => {
      const cell = document.createElement('td');
      cell.className = 'empty';
      row.append(cell);
    };

    const finishRow = () => {
      while (row.children.length < 7) addEmptyCell();
      daysBody.append(row);
      row = document.createElement('tr');
    };

    for (let i = 0; i < firstWeekday; i++) addEmptyCell();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObject = new Date(year, month, day);
      const state = unavailable.get(date);
      const isPast = dateObject < today;
      const cell = document.createElement('td');
      cell.className = `day ${state ? 'booked' : 'available'}`;
      cell.dataset.date = date;
      cell.tabIndex = isPast ? -1 : 0;
      cell.setAttribute('role', 'button');
      cell.setAttribute('aria-label', `${date}, ${state ? 'unavailable' : 'available'}`);
      if (isPast) cell.setAttribute('aria-disabled', 'true');
      if (date === selectedDate) cell.classList.add('selected');
      const number = document.createElement('span');
      number.className = 'num';
      number.textContent = String(day);
      const label = document.createElement('span');
      label.className = 'lbl';
      label.textContent = state ? 'Unavailable' : 'Available';
      cell.append(number, label);

      const chooseDate = () => {
        if (isPast) return;
        selectedDate = date;
        updateSelection();
        render();
      };
      cell.addEventListener('click', chooseDate);
      cell.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          chooseDate();
        }
      });
      row.append(cell);
      if (row.children.length === 7) finishRow();
    }
    if (row.children.length) finishRow();
    updateSelection();
  };

  const updateSelection = () => {
    if (!selectedDate) {
      selectedLabel.textContent = 'Pick a date';
      selectedStatus.textContent = 'Choose a date on the calendar to check it.';
      bookingLink.hidden = true;
      return;
    }

    const date = new Date(`${selectedDate}T00:00:00`);
    const state = unavailable.get(selectedDate);
    const available = !state;
    selectedLabel.textContent = date.toLocaleDateString('en-PH', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    selectedStatus.textContent = available
      ? 'No booking request is currently recorded for this date. Final availability is confirmed by our team.'
      : 'This date is unavailable.';
    selectedStatus.dataset.state = available ? 'success' : 'error';
    bookingLink.hidden = !available;
    const params = new URLSearchParams({ date: selectedDate });
    if (selectedStyle) params.set('style', selectedStyle);
    bookingLink.href = `booking.html?${params}`;
  };

  previous.addEventListener('click', () => {
    monthCursor.setMonth(monthCursor.getMonth() - 1);
    selectedDate = '';
    render();
  });
  next.addEventListener('click', () => {
    monthCursor.setMonth(monthCursor.getMonth() + 1);
    selectedDate = '';
    render();
  });
  await render();
}

async function renderMiniCalendar(calendarId, monthId, messageId) {
  const calendar = document.getElementById(calendarId);
  const monthLabel = document.getElementById(monthId);
  const status = document.getElementById(messageId);
  if (!calendar || !monthLabel) return;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  monthLabel.textContent = today.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  calendar.replaceChildren();

  const appendDay = (className, text) => {
    const day = document.createElement('span');
    day.className = className;
    day.textContent = text;
    calendar.append(day);
  };

  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((day) => appendDay('mini-dow', day));
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < firstWeekday; i++) appendDay('mini-day empty', '');

  try {
    const data = await apiRequest(`/api/availability/month?year=${year}&month=${month + 1}`);
    const unavailable = new Map(data.unavailableDates.map((item) => [item.date, item.status]));
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const state = unavailable.get(date);
      appendDay(`mini-day ${state ? 'booked' : 'available'}`, String(day));
    }
  } catch (error) {
    console.error('Unable to load availability calendar:', error);
    calendar.replaceChildren();
    setStatus(status, 'Availability is temporarily unavailable.', true);
  }
}

async function initReviews() {
  const grid = document.getElementById('reviews-grid');
  const status = document.getElementById('reviews-message');
  const loadMore = document.getElementById('load-reviews');
  const filters = Array.from(document.querySelectorAll('[data-review-filter]'));
  const limit = 6;
  let offset = 0;
  let selectedFilter = {};
  let requestSequence=0;

  const renderReview = (review) => {
    const card = document.createElement('div');
    card.className = 'review-card';
    const stars = document.createElement('p');
    stars.className = 'stars';
    stars.textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    const message = document.createElement('p');
    message.textContent = review.message;
    const reviewer = document.createElement('p');
    reviewer.className = 'reviewer';
    const name = document.createElement('strong');
    name.textContent = review.name;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = [review.event_type, review.package_name].filter(Boolean).join(' · ');
    reviewer.append(name);
    if (meta.textContent) {
      reviewer.append(document.createElement('br'), meta);
    }
    card.append(stars, message, reviewer);
    appendReviewCorrection(card,review.correction);
    return card;
  };

  const load = async (append) => {
    const sequence=++requestSequence;
    loadMore.disabled = true;
    setStatus(status, 'Loading feedback...', false);
    const params = new URLSearchParams({ limit: String(limit), offset: String(append ? offset : 0) });
    if (selectedFilter.rating) params.set('rating', selectedFilter.rating);
    if (selectedFilter.eventType) params.set('eventType', selectedFilter.eventType);

    try {
      const data = await apiRequest(`/api/reviews?${params}`);
      if(sequence!==requestSequence)return;
      if (!append) {
        grid.replaceChildren();
        offset = 0;
      }
      data.reviews.forEach((review) => grid.append(renderReview(review)));
      offset += data.reviews.length;
      setStatus(status, data.total ? '' : 'No public feedback matches this filter yet.', false);
      const noMoreReviews = offset >= data.total;
      loadMore.hidden = noMoreReviews;
      loadMore.parentElement.hidden = noMoreReviews;
      loadMore.disabled = false;
      updateReviewSummary(data.summary);
    } catch (error) {
      if(sequence!==requestSequence)return;
      setStatus(status, `Feedback could not be loaded: ${error.message}`, true);
      loadMore.disabled = false;
    }
  };

  filters.forEach((filter) => {
    filter.addEventListener('click', (event) => {
      event.preventDefault();
      selectedFilter = {};
      if (filter.dataset.reviewRating) selectedFilter.rating = filter.dataset.reviewRating;
      if (filter.dataset.reviewEvent) selectedFilter.eventType = filter.dataset.reviewEvent;
      filters.forEach((item) => {
        item.classList.toggle('btn-dark', item === filter);
        item.classList.toggle('btn-outline', item !== filter);
        item.setAttribute('aria-pressed', item === filter ? 'true' : 'false');
      });
      load(false);
    });
  });

  loadMore.addEventListener('click', () => load(true));
  refreshPublicReviews = async () => {
    selectedFilter = {};
    filters.forEach((item, index) => {
      const active = index === 0;
      item.classList.toggle('btn-dark', active);
      item.classList.toggle('btn-outline', !active);
      item.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    await load(false);
  };
  await load(false);
}

async function initHomepageReviews() {
  const grid = document.getElementById('home-testimonials');
  const status = document.getElementById('home-reviews-message');
  try {
    const data = await apiRequest('/api/reviews?limit=3&featured=true');
    if (!data.reviews.length) {
      status.textContent = 'Customer reviews will appear here when shared.';
      return;
    }

    data.reviews.forEach((review) => {
      const card = document.createElement('div');
      card.className = 'review-card';
      const stars = document.createElement('p');
      stars.className = 'stars';
      stars.textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
      const message = document.createElement('p');
      message.textContent = review.message;
      const reviewer = document.createElement('p');
      reviewer.className = 'reviewer';
      const name = document.createElement('strong');
      name.textContent = review.name;
      const event = document.createElement('span');
      event.textContent = review.event_type || 'Customer review';
      reviewer.append(name, document.createElement('br'), event);
      card.append(stars, message, reviewer);
      appendReviewCorrection(card,review.correction);
      grid.append(card);
    });
  } catch (error) {
    console.error('Unable to load public reviews:', error);
    status.textContent = 'Customer reviews are temporarily unavailable.';
  }
}

function appendReviewCorrection(card,correction) {
  if(!correction)return;
  const note=document.createElement('p');
  note.className='muted small';
  note.textContent='Editorial note: '+correction;
  card.append(note);
}

function initPackageBookingLinks() {
  if (!window.location.pathname.endsWith('/packages.html')) return;
  document.querySelectorAll('.package-card').forEach((card) => {
    const packageName = card.querySelector('h3')?.textContent.trim();
    if (!packageName) return;
    card.querySelectorAll('a[href="booking.html"]').forEach((link) => {
      link.href = `booking.html?package=${encodeURIComponent(packageName)}`;
    });
  });
}

function updateReviewSummary(summary) {
  const score = document.getElementById('review-score');
  const count = document.getElementById('review-count');
  const breakdown = document.getElementById('review-breakdown');
  if (score) score.textContent = summary.average.toFixed(1);
  if (count) count.textContent = `Based on ${summary.count} public review${summary.count === 1 ? '' : 's'}`;
  if (!breakdown) return;

  const rows = breakdown.querySelectorAll('[data-rating-row]');
  rows.forEach((row) => {
    const rating = Number(row.dataset.ratingRow);
    const value = summary.distribution[rating] || 0;
    const total = summary.count || 0;
    const bar = row.querySelector('.bar span');
    const countLabel = row.querySelector('[data-count]');
    if (bar) bar.style.width = `${total ? (value / total) * 100 : 0}%`;
    if (countLabel) countLabel.textContent = String(value);
  });
}

async function initSessionState() {
  const isProfilePage = window.location.pathname.endsWith('/profile.html');
  try {
    const result = await apiRequest('/api/auth/session');
    if (!result.authenticated) {
      if (isProfilePage) window.location.replace('login.html');
      return;
    }

    document.querySelectorAll('.auth-link[href$="#login"], .auth-link[href$="#signup"]').forEach((link) => {
      link.style.display = 'none';
    });

    const profileLinks = document.querySelectorAll('a[href="profile.html"]');
    profileLinks.forEach((link) => {
      link.textContent = 'Profile';
    });
  } catch (error) {
    console.error('Session check failed:', error);
    if (isProfilePage) {
      setStatus(document.getElementById('profile-message'), 'Your account could not be loaded. Please try again.', true);
      return;
    }
  }

  if (isProfilePage) {
    loadProfileData();
  }
}

async function loadProfileData() {
  try {
    const session = await apiRequest('/api/auth/session');
    if (!session.authenticated) {
      window.location.href = 'login.html';
      return;
    }

    const profile = await apiRequest('/api/customers/me');
    void window.loadCustomerInquiries?.();
    const user = profile.user;

    const nameHeading = document.querySelector('.profile-summary-name');
    const summaryMeta = document.querySelector('.profile-summary-meta');
    if (nameHeading) nameHeading.textContent = user.name;
    const avatar = document.querySelector('.account-layout .profile-link');
    if (avatar) avatar.textContent = user.name.trim().charAt(0).toUpperCase();
    if (summaryMeta) {
      const joinDate = new Date(user.created_at).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
      summaryMeta.textContent = `${user.email} | Member since ${joinDate}`;
    }

    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const profilePhone = document.getElementById('profile-phone');
    const profileCity = document.getElementById('profile-city');
    const profileAddress = document.getElementById('profile-address');

    if (profileName) profileName.value = user.name || '';
    if (profileEmail) profileEmail.value = user.email || '';
    if (profilePhone) profilePhone.value = user.phone || '';
    if (profileCity) profileCity.value = user.city || '';
    if (profileAddress) profileAddress.value = user.address || '';

    const bookings = await apiRequest('/api/bookings/mine');
    const list = document.getElementById('booking-list');
    if (list) {
      if (!bookings.bookings.length) {
        const empty = document.createElement('p');
        empty.className = 'muted small center mt-20 m-0';
        empty.textContent = 'No bookings yet.';
        list.replaceChildren(empty);
        return;
      }

      const bookingItems = bookings.bookings.map((booking) => {
        const item = document.createElement('div');
        item.className = 'account-booking';
        const details = document.createElement('div');
        const packageName = document.createElement('h3');
        packageName.textContent = booking.package_name;
        const event = document.createElement('p');
        event.className = 'muted small';
        event.textContent = `${new Date(`${booking.event_date}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} | ${booking.venue}`;
        const reference = document.createElement('p');
        reference.className = 'small m-0';
        reference.textContent = `Reference: ${booking.reference} | Status: ${booking.status}${booking.selected_style ? ` | Style: ${booking.selected_style}` : ''}`;
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = booking.status;
        if(window.BBHoldCountdown){const timer=document.createElement('div');details.append(timer);BBHoldCountdown(timer,booking,()=>loadProfileData());}
        const manage = document.createElement('a'); manage.className = 'btn btn-outline';
        manage.href = 'manage-booking.html?reference=' + encodeURIComponent(booking.reference); manage.textContent = 'Manage booking';
        details.append(packageName, event, reference, manage);
        const statusActions=document.createElement('div');statusActions.className='booking-status-actions';statusActions.append(tag);
        const future=new Date(`${booking.event_date}T${booking.event_time}:00+08:00`)>new Date();
        if(['pending','confirmed'].includes(booking.status)&&future){
          const cancel=document.createElement('button');cancel.type='button';cancel.className='btn btn-outline booking-cancel';cancel.textContent='Cancel booking';
          cancel.addEventListener('click',async()=>{
            cancel.disabled=true;
            try { if(await window.BBCancelBooking(booking))await loadProfileData(); }
            finally { cancel.disabled=false; if(cancel.isConnected)cancel.focus(); }
          });
          statusActions.append(cancel);
        }
        item.append(details, statusActions);
        return item;
      });
      list.replaceChildren(...bookingItems);
    }
  } catch (error) {
    console.error('Profile data loading failed:', error);
    if (window.location.pathname.endsWith('/profile.html')) {
      window.location.href = 'login.html';
    }
  }
}


/* Mobile menu button: shows and hides the nav and sign-in links on phones */
(function () {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const nav = header.querySelector('.site-nav');
  const actions = header.querySelector('.header-actions');
  if (!nav && !actions) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-toggle';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Open menu');
  btn.innerHTML = '<span></span><span></span><span></span>';
  header.append(btn);
  const close = () => {
    header.classList.remove('nav-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Open menu');
  };
  btn.addEventListener('click', () => {
    const open = header.classList.toggle('nav-open');
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  header.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
function safeAuthReturn(){
 const value=new URLSearchParams(location.search).get('next');
 if(value){try{const target=new URL(value,location.href);if(target.origin===location.origin&&['booking.html','manage-booking.html','profile.html'].some(p=>target.pathname==='/Bouncebash_CS/'+p))return target.pathname+target.search;}catch{}}
 return 'profile.html';
}

document.addEventListener('DOMContentLoaded', async () => {
  const footer=document.querySelector('.site-footer');
  if(!footer)return;
  try{
    const {settings}=await apiRequest('/api/business-settings');
    const details=settings?.contact;
    if(!details||!Object.values(details).some(Boolean))return;
    const section=document.createElement('div');section.className='footer-col';
    const heading=document.createElement('h4');heading.textContent=details.name||'Contact';section.append(heading);
    for(const [value,scheme] of [[details.email,'mailto:'],[details.phone,'tel:']]){
      if(!value)continue;
      const existing=footer.querySelector('a[href^="'+scheme+'"]');
      const link=existing||document.createElement('a');
      link.href=scheme+(scheme==='tel:'?value.replace(/[^+\d]/g,''):value);link.textContent=value;
      if(!existing)section.append(link);
    }
    for(const value of [details.area,details.hours])if(value){const p=document.createElement('p');p.textContent=value;section.append(p);}
    footer.append(section);
  }catch{/* Retain the existing contact links if the settings request fails. */}
});
