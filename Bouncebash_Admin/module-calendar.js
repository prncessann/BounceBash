
'use strict';
(()=>{const main=document.querySelector('main[data-admin-page="calendar"]');if(!main)return;document.body.dataset.bbCalendarFix='v4';const host=document.getElementById('admin-content'),intro=document.createElement('section');intro.className='mod-overview';main.insertBefore(intro,host);
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


/* Accessible compact month/year controls and live date badges. The existing
   calendar and date-block API event handlers remain untouched. */
(()=>{
  const main=document.querySelector('main[data-admin-page="calendar"]');
  const host=document.getElementById('admin-content');if(!main||!host)return;
  const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const phToday=()=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const item=t=>parts.find(p=>p.type===t)?.value||'';return `${item('year')}-${item('month')}-${item('day')}`;};
  function makeSelect(label,name,options,value){
    const wrap=document.createElement('label');wrap.className='fld '+(name==='year'?'mod-year-label':'');wrap.append(document.createTextNode(label));
    const select=document.createElement('select');select.className='inp';select.name='mod-'+name;
    for(const [v,text] of options){const option=new Option(text,v);if(v===value)option.selected=true;select.add(option);}
    wrap.append(select);return [wrap,select];
  }
  function enhance(){
    const area=host.querySelector('.admin-calendar');const grid=area?.querySelector('.cal');if(!grid)return;
    const left=area.querySelector(':scope > .card');const toolbar=left?.querySelector(':scope > .acts');
    if(toolbar&&!toolbar.classList.contains('mod-calendar-toolbar')){
      toolbar.classList.add('mod-calendar-toolbar');
      const nav=document.createElement('div');nav.className='mod-calendar-pager';
      const buttons=[...toolbar.children].filter(el=>el.matches('button'));
      for(const button of buttons){button.textContent=button.textContent.includes('Previous')?'← Previous':'Next →';nav.append(button);}
      toolbar.prepend(nav);
      const form=toolbar.querySelector('form.admin-form');const monthInput=form?.querySelector('input[type="month"]');
      if(form&&monthInput){
        form.classList.add('mod-calendar-jump');
        monthInput.closest('label')?.classList.add('mod-native-month');
        monthInput.tabIndex=-1;monthInput.setAttribute('aria-hidden','true');
        const [y,m]=monthInput.value.split('-').map(Number);
        const [monthLabel,monthSelect]=makeSelect('Month','month',monthNames.map((name,i)=>[String(i+1).padStart(2,'0'),name]),String(m).padStart(2,'0'));
        const years=Array.from({length:31},(_,i)=>{const yr=y-10+i;return [String(yr),String(yr)];});
        const [yearLabel,yearSelect]=makeSelect('Year','year',years,String(y));
        const sync=()=>{monthInput.value=yearSelect.value+'-'+monthSelect.value;};
        monthSelect.addEventListener('change',sync);yearSelect.addEventListener('change',sync);
        form.insertBefore(monthLabel,monthInput.closest('label'));
        form.insertBefore(yearLabel,monthInput.closest('label'));
        form.addEventListener('submit',sync,{capture:true});
      }
    }
    const today=phToday();
    for(const cell of grid.querySelectorAll('button.day[aria-label]')){
      if(cell.classList.contains('mod-cal-enhanced'))continue;
      cell.classList.add('mod-cal-enhanced');
      const date=cell.getAttribute('aria-label').slice(0,10);
      const oldBadge=cell.querySelector(':scope > .ev');
      const state=oldBadge?(oldBadge.textContent.trim()==='Blocked'?'blocked':'reserved'):(date<today?'past':'available');
      const badge=oldBadge||document.createElement('span');
      badge.className='mod-cal-status '+state;
      badge.textContent=state[0].toUpperCase()+state.slice(1);
      if(!oldBadge)cell.append(badge);
      cell.classList.add('cal-'+state);
      cell.setAttribute('aria-label',date+' '+state);
      cell.dataset.bbDate=date;
      cell.setAttribute('aria-pressed',String(area.querySelector(':scope > .card:nth-child(2) > h2')?.textContent.trim()===date));
      cell.addEventListener('click',()=>{
        for(const other of grid.querySelectorAll('button.day'))other.setAttribute('aria-pressed',String(other===cell));
      });
    }
  }
  const observer=new MutationObserver(()=>{observer.disconnect();try{enhance();}finally{observer.observe(host,{childList:true});}});
  observer.observe(host,{childList:true});enhance();
})();
