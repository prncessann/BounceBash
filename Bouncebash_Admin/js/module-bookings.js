
'use strict';
(()=>{
 const main=document.querySelector('main[data-admin-page="bookings"]');if(!main)return;
 const host=document.getElementById('admin-content'),panel=document.createElement('section');panel.className='mod-overview';main.insertBefore(panel,host);
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
 const money=c=>c==null?'Awaiting quotation':new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(c)/100);
 let updating=false,sequence=0;
 function addSummaryCard(grid,title,items,note,tone){const card=el('div','mod-summary-card '+tone);card.append(el('h3','',title+' · '+items.length),el('p','',note));const list=el('ul');for(const b of items.slice(0,5)){const li=el('li');const name=el('strong','',b.reference||b.reference_code||'Booking');li.append(name,document.createTextNode((b.name||'')+' · '+(b.event_date||'')+' · Balance '+money(b.balance_cents)));list.append(li);}if(!items.length)list.append(el('li','','No active bookings in this category.'));card.append(list);grid.append(card);}
 function decorate(){
  const cards=[...host.querySelectorAll(':scope > section.card')];const bookingsCard=cards.find(c=>c.querySelector('h2')?.textContent?.includes('bookings'));
  if(bookingsCard){bookingsCard.classList.add('mod-booking-list');const table=bookingsCard.querySelector('table');if(table){[...table.tBodies].flatMap(b=>[...b.rows]).forEach(r=>{const cell=r.cells[4];if(cell&&!cell.querySelector('.mod-status')){const value=cell.textContent.trim();cell.replaceChildren(el('span','mod-status '+value.toLowerCase(),value));}});}}
  const filter=host.querySelector(':scope > form.admin-form');if(filter)filter.classList.add('mod-booking-filters');
  const controls=host.querySelector(':scope > .acts');if(controls)controls.classList.add('mod-booking-actions');
 }
 async function render(){if(updating)return;updating=true;const seq=++sequence;decorate();try{
  // Fetch up to 1000 recent bookings, without changing or writing records.
  let bookings=[],total=0;for(let offset=0;offset<1000;offset+=200){const resp=await fetch('/api/operator/bookings?limit=200&offset='+offset,{credentials:'same-origin'});if(!resp.ok)throw new Error('Booking overview unavailable');const data=await resp.json();bookings.push(...(data.bookings||[]));total=Number(data.total||0);if(bookings.length>=total)break;}
  if(seq!==sequence)return;
  const active=bookings.filter(b=>['pending','confirmed'].includes(b.status));
  const noPay=active.filter(b=>Number(b.paid_cents||0)===0),balance=active.filter(b=>Number(b.paid_cents||0)>0 && (b.balance_cents===null||Number(b.balance_cents)>0));
  const heading=el('h2','mod-section-title','Needs attention');const sub=el('p','mod-sub','Real active bookings grouped by verified payments and remaining balance.'),g=el('div','mod-summary-grid');
  addSummaryCard(g,'Not paid',noPay,'No verified payment recorded.','red');addSummaryCard(g,'Balance due',balance,'Partially paid bookings with a balance.','gold');
  const tabs=el('div','mod-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Booking filters');
  const form=host.querySelector(':scope > form.admin-form'),status=form?.querySelector('[name="status"]'),payment=form?.querySelector('[name="payment"]');
  const opts=[['All', '', ''],['Needs attention','','balance'],['Pending','pending',''],['Confirmed','confirmed',''],['Completed','completed',''],['Cancelled','cancelled',''],['Expired','expired','']];
  for(const [label,s,p] of opts){const b=el('button','',label);b.type='button';const pressed=Boolean(status&&payment&&status.value===s&&payment.value===p);b.setAttribute('aria-pressed',String(pressed));b.onclick=()=>{if(!form||!status||!payment)return;status.value=s;payment.value=p;form.requestSubmit();};tabs.append(b);}
  const note=total>bookings.length?el('p','mod-sub','Attention summary shows the newest '+bookings.length+' of '+total+' bookings.') : null;
  panel.replaceChildren(heading,sub,g,tabs,...(note?[note]:[]));
 }catch(error){panel.replaceChildren(el('p','mod-sub','Attention summary unavailable. Booking filters and actions still work.'));}finally{updating=false;}}
 const observer=new MutationObserver(()=>{observer.disconnect();render().finally(()=>observer.observe(host,{childList:true}));});observer.observe(host,{childList:true});if(host.children.length)render();
})();
