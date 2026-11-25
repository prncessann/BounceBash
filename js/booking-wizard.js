'use strict';
const bookingScriptUrl = document.currentScript.src;
(() => {
 const form=document.getElementById('booking-form');if(!form?.dataset.wizard)return;
 const $=id=>document.getElementById(id),money=value=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(value/100);
 const panels=[...form.querySelectorAll('[data-step]')],next=$('wizard-next'),back=$('wizard-back'),submit=$('wizard-submit'),inquire=$('wizard-inquire');
 const key='bb-booking-draft-v2';let step=0,catalog,user,rentals=[],selected=null,quoteGeneration=0,busy=false,reviewToken;
 const fields=['rental-variant','name','contact','event-date','event-time','city-id','venue','extra-hours','notes','ball-color','arch-quantity','arch-color-count','arch-color-1','arch-color-2','arch-color-3','backdrop-event','backdrop-other'];
 const checks=['arch-selected','backdrop-selected'];
 function message(text,bad=false){$('booking-message').textContent=text;$('booking-message').dataset.state=bad?'error':'success';}
 function draft(){return {version:2,rentalId:selected?.id,fields:Object.fromEntries(fields.map(id=>[id,$(id)?.value||''])),checks:Object.fromEntries(checks.map(id=>[id,!!$(id)?.checked])),step,savedAt:Date.now()};}
 function save(){try{sessionStorage.setItem(key,JSON.stringify(draft()));}catch{}}
 function read(){try{const value=JSON.parse(sessionStorage.getItem(key)||'null');return value?.version===2&&Date.now()-value.savedAt<86400000?value:null;}catch{return null;}}
 function error(input,text){
  input.classList.add('field-invalid');input.setAttribute('aria-invalid','true');let hint=$(input.id+'-error');
  if(!hint){hint=document.createElement('p');hint.id=input.id+'-error';hint.className='field-error';(input.closest('.field')||input.parentElement).append(hint);}
  if(hint){hint.textContent=text;hint.hidden=false;const old=input.getAttribute('aria-describedby')||'';if(!old.split(' ').includes(hint.id))input.setAttribute('aria-describedby',(old+' '+hint.id).trim());}
 }
 function clear(input){input.classList.remove('field-invalid');input.removeAttribute('aria-invalid');const hint=$(input.id+'-error');if(hint)hint.hidden=true;}
 function requiredPanel(index){let first=null;for(const input of panels[index].querySelectorAll('input,select,textarea')){if(input.disabled||input.type==='radio'||input.type==='checkbox'&&!input.required)continue;clear(input);if(!input.checkValidity()){error(input,input.validity.valueMissing?'Please complete this field.':input.validity.rangeOverflow?'This value is above the allowed maximum.':input.validity.rangeUnderflow?'This value is below the allowed minimum.':'Please enter a valid value.');first ||=input;}}return first;}
 async function validate(index){
  let first=requiredPanel(index);
  if(index===0&&!selected){$('rental-error').textContent='Choose a rental item.';$('rental-error').hidden=false;$('rental-grid').classList.add('field-invalid');first ||= $('rental-grid').querySelector('input');}
  if(index===1){const digits=$('contact').value.replace(/\D/g,'');if(!/^\+?\d[\d ()-]{5,28}\d$/.test($('contact').value.trim())||digits.length<7||digits.length>15){error($('contact'),'Enter a valid contact number with 7–15 digits.');first ||= $('contact');}
   if($('event-date').value&&$('event-time').value&&new Date(`${$('event-date').value}T${$('event-time').value}:00+08:00`)<=new Date()){error($('event-time'),'Choose a future event date and time (Philippine time).');first ||= $('event-time');}
  }
  if(index===2&&$('arch-selected').checked){const values=Array.from({length:Number($('arch-color-count').value)},(_,i)=>$('arch-color-'+(i+1)).value);if(new Set(values).size!==values.length){error($('arch-color-2'),'Choose different colors; do not repeat a color.');first ||= $('arch-color-2');}}
  if(first){first.focus();message('Please complete the highlighted fields.',true);return false;}
  if(index===1){try{const result=await apiRequest('/api/availability?date='+encodeURIComponent($('event-date').value));$('date-status').textContent=result.available?'This date is currently available.':'This date is unavailable. Choose another date.';if(!result.available){error($('event-date'),'This date is unavailable.');$('event-date').focus();return false;}}catch(e){message(e.message,true);return false;}}
  return true;
 }
 function addons(){const items=[];
  if(selected?.includes_balls&&catalog.addOns.some(extra=>extra.name==='Ball colors'))items.push({name:'Ball colors',color:$('ball-color').value});
  if($('arch-selected').checked)items.push({name:'Balloon arch',quantity:Number($('arch-quantity').value),colors:Array.from({length:Number($('arch-color-count').value)},(_,i)=>$('arch-color-'+(i+1)).value)});
  if($('backdrop-selected').checked)items.push({name:'Backdrop & signage',eventType:$('backdrop-event').value,otherEvent:$('backdrop-other').value.trim()});return items;
 }
 function payload(){return {rentalId:selected?.id,packageId:selected?.packageId,variantId:$('rental-variant').value||null,name:$('name').value.trim(),contact:$('contact').value.trim(),eventDate:$('event-date').value,eventTime:$('event-time').value,cityId:$('city-id').value,venue:$('venue').value.trim(),extraHours:Number($('extra-hours').value),notes:$('notes').value.trim(),addOnItems:addons(),reservationFeeAccepted:$('reservation-fee').checked};}
 function priceLines(container,data){
  container.replaceChildren();const title=document.createElement('h3');title.textContent=data.pricing_state==='pending_quote'?'Final total pending admin quotation':'Final total';container.append(title);
  const rows=[['Rental ('+data.included_hours+' hours)',data.base_price_cents],...data.add_ons.map(i=>[i.name+(i.quantity>1?' × '+i.quantity:''),i.unit_price_cents*i.quantity]),['Additional hours ('+data.extra_hours+')',data.extra_hours_cents],['Delivery — '+data.city_name,data.delivery_cents],['Known subtotal',data.subtotal_cents]];
  if(data.total_cents!==null)rows.push(['Final total',data.total_cents],['Required deposit (50%)',data.deposit_cents]);
  for(const [label,value]of rows){const row=document.createElement('div');row.className='price-line';const name=document.createElement('span');name.textContent=label;const amount=document.createElement('strong');amount.textContent=money(value);row.append(name,amount);container.append(row);}
  if(data.pricing_state==='pending_quote'){const p=document.createElement('p');p.className='quote-pending';p.textContent='Notes require an admin quotation. The subtotal is not payable yet; the three-hour hold still starts on submission.';container.append(p);}
 }
 async function updateQuote(){const generation=++quoteGeneration;
  if(!selected||!$('city-id').value||($('rental-variant').required&&!$('rental-variant').value)){$('wizard-price').textContent='Choose a rental, style/color and location to calculate the full price.';return false;}
  try{const data=await apiRequest('/api/quotes',{method:'POST',body:JSON.stringify(payload())});if(generation!==quoteGeneration){message('Your selections changed. Review your booking again.',true);return false;}reviewToken=data.quote.review_token;priceLines($('wizard-price'),data.quote);return true;}
  catch(e){if(generation===quoteGeneration){$('wizard-price').textContent=e.message;message(e.message,true);}return false;}
 }
 function invalidateQuote(){quoteGeneration++;if(!busy)inquire.disabled=false;}
 function showStep(index){step=index;panels.forEach((panel,i)=>{panel.hidden=i!==index;});[...$('wizard-steps').children].forEach((li,i)=>{li.classList.toggle('step-current',i===index);li.classList.toggle('step-done',i<index);if(i===index)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});back.hidden=index===0;next.hidden=index===3;submit.hidden=inquire.hidden=index!==3;next.textContent=index===2?'Review booking':'Continue';panels[index].querySelector('h2').focus();message('');save();}
 function review(){const target=$('booking-review');target.replaceChildren();if(selected){const img=document.createElement('img');img.src=selected.image_url;img.alt=selected.name;img.className='review-photo';target.append(img);}const body=payload();const rows=[['Rental',selected.name],['Style/color',$('rental-variant').selectedOptions[0]?.textContent||''],['Customer',body.name],['Contact',body.contact],['Event',`${body.eventDate} ${body.eventTime} (Philippine time)`],['Venue',$('city-id').selectedOptions[0].textContent+' · '+body.venue],['Notes',body.notes||'None — price shown is final']];for(const item of addons()){if(item.name==='Ball colors')rows.push(['Ball color',item.color+' (+₱0)']);if(item.name==='Balloon arch')rows.push(['Balloon arch',item.quantity+' arch(es), '+item.colors.join(', ')]);if(item.name==='Backdrop & signage')rows.push(['Backdrop event',item.eventType==='Other'?item.otherEvent:item.eventType]);}for(const [name,value]of rows){const p=document.createElement('p');const label=document.createElement('strong');label.textContent=name+': ';p.append(label,document.createTextNode(value));target.append(p);}}
 function configureExtras(){const arch=$('arch-selected').checked,backdrop=$('backdrop-selected').checked,count=Number($('arch-color-count').value);$('arch-fields').hidden=!arch;$('backdrop-fields').hidden=!backdrop;for(const id of ['arch-quantity','arch-color-count']){$(id).disabled=!arch;$(id).required=arch;}
  for(let i=1;i<=3;i++){const field=$('arch-color-'+i);field.closest('.field').hidden=!arch||i>count;field.disabled=!arch||i>count;field.required=arch&&i<=count;}
  $('backdrop-event').disabled=!backdrop;$('backdrop-event').required=backdrop;const other=backdrop&&$('backdrop-event').value==='Other';$('other-event-field').hidden=!other;$('backdrop-other').disabled=!other;$('backdrop-other').required=other;
  const ballColors=Boolean(selected?.includes_balls&&catalog.addOns.some(extra=>extra.name==='Ball colors'));
  $('ball-colors-section').hidden=!ballColors;$('ball-color').disabled=!ballColors;$('ball-color').required=ballColors;
 }
 function pick(item,variantValue='') {selected=item;$('rental-grid').classList.remove('field-invalid');$('rental-error').hidden=true;const variants=catalog.variants.filter(v=>v.model_id===item.id);$('rental-variant').replaceChildren(new Option(variants.length?'Choose a style/color':'Standard appearance',''),...variants.map(v=>new Option(v.name+(item.is_demo?' · +₱0':''),String(v.id))));$('rental-variant').required=variants.length>0;if(variantValue)$('rental-variant').value=variantValue;if(!variants.length)$('rental-variant').value='';$('rental-safety').textContent='Follow the equipment’s posted capacity and safety rules. There is no per-child fee.';$('included-hours').textContent=`${item.rental_hours} rental hours included. Each additional hour costs +${money(catalog.extra_hour_cents)}.`;form.querySelectorAll('.rental-option').forEach(card=>card.classList.toggle('rental-selected',card.dataset.id===String(item.id)));configureExtras();save();invalidateQuote();}
 function cards(){const zone=$('zone-filter').value;const target=$('rental-grid');target.replaceChildren();for(const item of rentals.filter(r=>!zone||r.zone_id===Number(zone))){const label=document.createElement('label');label.className='rental-option';label.dataset.id=String(item.id);const radio=document.createElement('input');radio.type='radio';radio.name='rental-choice';radio.value=String(item.id);radio.checked=selected?.id===item.id;radio.addEventListener('change',()=>pick(item));const img=document.createElement('img');img.src=item.image_url||new URL('../assets/photos/castle-bounce-cake-table.jpg', bookingScriptUrl).href;img.alt=item.name;img.loading='lazy';const h=document.createElement('h3');h.textContent=item.name;const price=document.createElement('p');price.className='rental-price';price.textContent=money(item.base_price_cents)+' / '+item.rental_hours+' hours';const caption=document.createElement('p');caption.className='small muted';caption.textContent=item.is_demo?'Demo rate · illustrative photo · color options':'Choose a supported style/color below';label.append(radio,img,h,price,caption);if(selected?.id===item.id)label.classList.add('rental-selected');target.append(label);}if(!target.children.length)target.textContent='No configured rentals in this zone yet. Please contact the team.';}
 async function forward(){if(busy)return;busy=true;next.disabled=true;try{if(!await validate(step))return;if(step===0&&!user){save();$('booking-auth').hidden=false;$('booking-sign-in').focus();message('Sign in to continue. Your rental selection is saved.',true);return;}if(step===2){if(!await updateQuote())return;review();}showStep(step+1);}finally{busy=false;next.disabled=false;}}
 next.addEventListener('click',forward);back.addEventListener('click',()=>{if(!busy)showStep(step-1);});
 inquire.addEventListener('click',async()=>{
  if(busy||step!==3)return;
  busy=true;inquire.disabled=true;submit.disabled=true;back.disabled=true;message('Sending your inquiry…');
  let saved=false;
  try{
   const result=await apiRequest('/api/inquiries/mine',{method:'POST',body:JSON.stringify(payload())});
   saved=true;message(result.message+' View it under My Inquiries in your profile.');
  }catch(error){message(error.message,true);}
  finally{busy=false;inquire.disabled=saved;submit.disabled=false;back.disabled=false;}
 });
 form.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.tagName!=='TEXTAREA'&&event.target.tagName!=='BUTTON'&&step<3){event.preventDefault();forward();}});
 form.addEventListener('input',event=>{if(event.target.id)clear(event.target);save();invalidateQuote();});form.addEventListener('change',()=>{configureExtras();save();invalidateQuote();});
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;if(step!==3){forward();return;}if(!await validate(3))return;busy=true;submit.disabled=true;back.disabled=true;
  try{for(let i=0;i<3;i++)if(!await validate(i)){showStep(i);await validate(i);return;}
   const result=await apiRequest('/api/bookings',{method:'POST',body:JSON.stringify({...payload(),reviewToken})});try{sessionStorage.removeItem(key);}catch{}form.hidden=true;$('wizard-steps').hidden=true;const success=$('booking-success');success.hidden=false;const h=document.createElement('h2');h.textContent='Booking submitted';const p=document.createElement('p');p.textContent=result.message;const ref=document.createElement('p');ref.textContent='Booking reference: '+result.booking.reference;const timer=document.createElement('div');const link=document.createElement('a');link.className='btn btn-book';link.href='profile.html';link.textContent='View My Bookings';success.replaceChildren(h,p,ref,timer,link);BBHoldCountdown(timer,{...result.booking,status:'pending'},()=>{timer.textContent='Hold elapsed. Open your profile to check the latest status.';});message('');BBNotify?.success('Booking submitted. View it in your profile.');success.scrollIntoView?.({behavior:'smooth'});
  }catch(e){if(e.message.startsWith('Pricing changed.')){await updateQuote();$('reservation-fee').checked=false;}message(e.message,true);BBNotify?.error(e.message);}finally{busy=false;submit.disabled=false;back.disabled=false;}
 });
 async function init(){try{const [data,session]=await Promise.all([apiRequest('/api/catalog'),apiRequest('/api/auth/session')]);catalog=data;
  for(const [name,choice,price,suffix] of [['Balloon arch','arch-selected','arch-price',' per arch'],['Backdrop & signage','backdrop-selected','backdrop-price','']]){
   const extra=data.addOns.find(a=>a.name===name);
   $(choice).closest('.addon-choice').hidden=!extra;
   if(extra)$(price).textContent='+'+money(extra.unit_price_cents)+suffix;
  }
  user=session.authenticated?session.user:null;$('booking-auth').hidden=!!user;
  rentals=data.models.map(model=>{
   const links=data.packageModels.filter(link=>link.model_id===model.id);
   const offerId=model.booking_package_id||(links.length===1?links[0].package_id:null);
   const offer=data.packages.find(entry=>entry.id===offerId);
   if(!offer||!links.some(link=>link.package_id===offerId)||!Number.isInteger(offer.base_price_cents)||!Number.isInteger(offer.rental_hours))return null;
   return {...model,packageId:offer.id,base_price_cents:offer.base_price_cents,rental_hours:offer.rental_hours};
  }).filter(Boolean);
  $('zone-filter').append(...data.zones.map(z=>new Option(z.name,String(z.id))));$('city-id').append(...[...data.cities].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>new Option(c.name+' (+delivery '+money(c.delivery_cents)+')',c.id)));
  for(let i=0;i<=12;i++)$('extra-hours').append(new Option(i===0?'No additional hours (+₱0)':`${i} additional hour${i>1?'s':''} (+${money(i*data.extra_hour_cents)})`,String(i)));
  $('ball-color').append(...data.colors.map(c=>new Option(c+' (+₱0)',c)));
  for(let i=1;i<=3;i++){const field=document.createElement('div');field.className='field';const label=document.createElement('label');label.htmlFor='arch-color-'+i;label.textContent='Color '+i+' *';const select=document.createElement('select');select.id=label.htmlFor;select.append(new Option('Choose a color',''),...data.colors.map(c=>new Option(c+' (+₱0 included)',c)));field.append(label,select);$('arch-color-fields').append(field);}
  $('backdrop-event').append(...data.backdropEvents.map(e=>new Option(e+' (+'+money(catalog.addOns.find(a=>a.name==='Backdrop & signage')?.unit_price_cents ?? 0)+')',e)));
  $('event-date').min=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  $('name').value=user?.name||'';$('contact').value=user?.phone||'';const saved=read();if(saved){for(const [id,value]of Object.entries(saved.fields))if($(id))$(id).value=value;for(const [id,value]of Object.entries(saved.checks))if($(id)&&!$(id).closest('.addon-choice')?.hidden)$(id).checked=value;}
  const params=new URLSearchParams(location.search);const wanted=Number(params.get('rentalId')||params.get('modelId')||saved?.rentalId);const item=rentals.find(r=>r.id===wanted);if(item)pick(item,saved?.fields['rental-variant']);if(params.get('date'))$('event-date').value=params.get('date');const zone=data.zones.find(z=>z.slug===params.get('zone'));if(zone)$('zone-filter').value=String(zone.id);
  cards();configureExtras();$('zone-filter').addEventListener('change',cards);$('wizard-loading').hidden=true;form.hidden=false;$('wizard-steps').hidden=false;showStep(0);
 }catch(e){$('wizard-loading').textContent='Booking could not load: '+e.message;}}
 init();
})();
