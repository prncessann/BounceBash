
'use strict';
(()=>{const main=document.querySelector('main[data-admin-page="reports"]');if(!main)return;const host=document.getElementById('admin-content'),panel=document.createElement('section');panel.className='mod-overview';main.insertBefore(panel,host);
 const E=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=String(text);return n;};
 const pesos=c=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format((Number(c)||0)/100);
 let stamp=0;async function render(){const seq=++stamp;const form=host.querySelector(':scope > section.card form.admin-form');if(!form)return;const params=new URLSearchParams();for(const name of ['from','to','status']){const value=form.querySelector('[name="'+name+'"]')?.value;if(value)params.set(name,value);}try{
 const response=await fetch('/api/operator/overview?'+params,{credentials:'same-origin'});if(!response.ok)throw Error();const data=await response.json();if(seq!==stamp)return;const g=E('div','mod-summary-grid four');
 const activeCount=(data.bookings||[]).length;const verified=Number(data.totals?.net_collections_cents||0);const bookValue=Number(data.totals?.known_booking_value_cents||0);
 const items=[['Verified collections',pesos(verified),'Payment-receipt basis'],['Total bookings',activeCount,'Event-date basis'],['Average quoted booking',activeCount?pesos(bookValue/activeCount):'—','Known booking value ÷ booking count'],['Active receivables',pesos(data.totals?.outstanding_cents),'Pending/confirmed bookings']];
 for(const [title,val,desc] of items){const card=E('div','mod-summary-card');card.append(E('h3','',title),E('div','mod-value',val),E('p','',desc));g.append(card);}
 panel.replaceChildren(E('h2','mod-section-title','Sales & payments overview'),E('p','mod-sub','Live figures; collections are grouped by payment receipt dates, bookings by event dates.'),g);
 const metric=host.querySelector('.admin-metrics');if(metric)metric.classList.add('mod-reports-metrics');
 }catch{panel.replaceChildren(E('p','mod-sub','Report overview unavailable. The original report controls remain usable.'));}}
 const obs=new MutationObserver(()=>{obs.disconnect();render().finally(()=>obs.observe(host,{childList:true}));});obs.observe(host,{childList:true});if(host.children.length)render();
})();
