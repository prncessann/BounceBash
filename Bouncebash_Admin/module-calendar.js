
'use strict';
(()=>{const main=document.querySelector('main[data-admin-page="calendar"]');if(!main)return;const host=document.getElementById('admin-content'),intro=document.createElement('section');intro.className='mod-overview';main.insertBefore(intro,host);
 const E=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=String(text);return n;};
 let stamp=0;async function enhance(){const now=++stamp;const wrap=host.querySelector('.admin-calendar'),cal=wrap?.querySelector('.cal');if(!cal)return;wrap.classList.add('mod-calendar-layout');
 const legend=E('div','mod-calendar-legend');for(const [name,cls] of [['Available','free'],['Reserved','reserved'],['Blocked','blocked']]){const p=E('span','');p.append(E('i','mod-dot '+cls),document.createTextNode(name));legend.append(p);}
 intro.replaceChildren(E('h2','mod-section-title','Event calendar'),E('p','mod-sub','Select a date to view real bookings, availability, or create a staff date block.'),legend);
 const labels=[...cal.querySelectorAll('.day[aria-label]')];if(!labels.length)return;
 // Use existing backend results; preserve all date-cell click handlers.
 const first=labels[0].getAttribute('aria-label')?.slice(0,7);if(!first)return;
 const end=new Date(first+'-01T00:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);
 try{const response=await fetch('/api/operator/bookings?from='+first+'-01&to='+end.toISOString().slice(0,10)+'&limit=200',{credentials:'same-origin'});if(!response.ok)return;const data=await response.json();if(now!==stamp)return;
  const dates=new Map();for(const b of data.bookings||[]){const items=dates.get(b.event_date)||[];items.push(b);dates.set(b.event_date,items);}
  for(const cell of labels){const date=cell.getAttribute('aria-label').slice(0,10);if(cell.querySelector('.mod-day-events'))continue;const matched=dates.get(date)||[];if(!matched.length)continue;const count=E('span','mod-day-events',matched.length+' '+(matched.length===1?'booking':'bookings'));cell.append(count);}
 }catch{ /* Base calendar remains interactive even if enrichment fails. */ }
 }
 const obs=new MutationObserver(()=>{obs.disconnect();enhance().finally(()=>obs.observe(host,{childList:true,subtree:false}));});obs.observe(host,{childList:true});if(host.children.length)enhance();
})();
