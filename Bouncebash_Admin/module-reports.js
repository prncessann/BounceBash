 'use strict';
(() => {
  const main = document.querySelector('main[data-admin-page="reports"]');
  if (!main) return;
  const host = document.getElementById('admin-content');
  const panel = document.createElement('section');
  panel.className = 'mod-overview';
  main.insertBefore(panel, host);
  const status = document.getElementById('admin-message');
  const E = (tag, cls = '', value) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (value !== undefined && value !== null) el.textContent = String(value);
    return el;
  };
  const peso = cents => cents == null ? '—' : new Intl.NumberFormat('en-PH', {style:'currency',currency:'PHP'}).format(Number(cents)/100);
  const phpValue = cents => cents == null || cents === '' ? '' : (Number(cents)/100).toFixed(2);
  const todayPH = () => {
    const parts = new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const part = key => parts.find(p=>p.type===key)?.value;
    return [part('year'), part('month'), part('day')].join('-');
  };
  function periodForm() { return host.querySelector(':scope > section.card form.admin-form'); }
  function filters() {
    const form = periodForm();
    const q = new URLSearchParams();
    for (const name of ['from','to','status']) {
      const value = form?.querySelector('[name="'+name+'"]')?.value || '';
      if (value) q.set(name, value);
    }
    return q;
  }
  function selectPeriod(kind) {
    const form = periodForm(); if (!form) return;
    const day = todayPH(); let from=day, to=day;
    const year=day.slice(0,4), month=day.slice(5,7);
    if (kind === 'month') {
      from=year+'-'+month+'-01';
      to=year+'-'+month+'-'+String(new Date(Date.UTC(Number(year),Number(month),0)).getUTCDate()).padStart(2,'0');
    } else if (kind === 'year') {
      from=year+'-01-01'; to=year+'-12-31';
    }
    form.querySelector('[name="from"]').value=from;
    form.querySelector('[name="to"]').value=to;
    const state=form.querySelector('[name="status"]'); if(state)state.value='';
    form.requestSubmit();
  }
  async function currentData() {
    const response=await fetch('/api/operator/overview?'+filters().toString(), {credentials:'same-origin',headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('Report data unavailable. Try refreshing.');
    return response.json();
  }
  let serial=0, cached=null, lastQuery='';
  function removeLegacyReportActions(){
    const card=host.querySelector(':scope > section.card');
    if(!card)return;
    const labels=new Set(['Today','This month','This year','Generate PDF','Export bookings CSV','Export payments CSV']);
    for(const btn of card.querySelectorAll(':scope > .acts > button')){
      if(!labels.has(btn.textContent.trim())||btn.dataset.bbReportV7)return;
      const clean=btn.cloneNode(true);clean.dataset.bbReportV7='true';
      btn.replaceWith(clean); // Removes the original print/centavo-export handlers.
    }
  }
  async function render() {
    const form=periodForm(); if(!form)return;
    removeLegacyReportActions();
    const sequence=++serial;
    const current=filters().toString();
    try {
      const response=await fetch('/api/operator/overview?'+current,{credentials:'same-origin',headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('Not available');
      const data=await response.json();
      if(sequence!==serial)return;
      cached=data;lastQuery=current;
      const bookings=data.bookings||[];
      const count=bookings.length;
      const amount=Number(data.totals?.known_booking_value_cents||0);
      const entries=[
        ['Verified collections',peso(data.totals?.net_collections_cents||0),'By payment receipt date'],
        ['Total bookings',count,'By scheduled event date'],
        ['Average quoted booking',count?peso(amount/count):'—','Booking value ÷ booking count'],
        ['Active receivables',peso(data.totals?.outstanding_cents||0),'Pending or confirmed events']
      ];
      const cards=E('div','mod-summary-grid four');
      for(const [label,value,detail] of entries){
        const card=E('div','mod-summary-card');card.append(E('h3','',label),E('div','mod-value',value),E('p','',detail));cards.append(card);
      }
      const caption=E('p','mod-sub','Bookings are counted by scheduled event date; collections by payment receipt date. Month/Year presets include future events in that calendar period.');
      panel.replaceChildren(E('h2','mod-section-title','Sales & payments overview'),caption,cards);
      const metrics=host.querySelector('.admin-metrics');if(metrics)metrics.classList.add('mod-reports-metrics');
      const note=host.querySelector(':scope > section.card');
      if(note && !note.querySelector('.bb-report-filter-note')){
        note.append(E('p','bb-report-filter-note','Today = today only · This month = entire calendar month · This year = entire calendar year.'));
      }
    } catch(error) {
      if(sequence===serial)panel.replaceChildren(E('p','mod-sub','Report overview unavailable. Use Refresh to try again.'));
    }
  }
  // Hook into the existing Admin form; the backend remains the single source of truth.
  const observer = new MutationObserver(() => {
    observer.disconnect();
    render().finally(()=>observer.observe(host,{childList:true}));
  });
  observer.observe(host,{childList:true});
  if(host.children.length)render();

  function csvCell(value){
    let raw=String(value??'');
    // Prevent spreadsheets from interpreting customer-provided text as a formula.
    if(/^[\s]*[=+@-]|^[\t\r]/.test(raw))raw="'"+raw;
    return '"'+raw.replaceAll('"','""')+'"';
  }
  function downloadCsv(filename,rows){
    const csv='\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  async function exportData(type){
    const data=await currentData();
    const dateSuffix=(data.from||'start')+'_'+(data.to||'end');
    if(type==='bookings'){
      const rows=[['Reference','Customer','Event date','Time','Status','Rental','Total (PHP)','Verified (PHP)','Pending (PHP)','Balance (PHP)']];
      for(const b of data.bookings||[])rows.push([b.reference_code,b.name,b.event_date,b.event_time,b.status,b.package_name,phpValue(b.total_cents),phpValue(b.verified_cents),phpValue(b.pending_cents),phpValue(b.balance_cents)]);
      downloadCsv('bouncebash-bookings-'+dateSuffix+'.csv',rows);
    } else {
      const rows=[['Booking reference','Received at (UTC)','Status','Amount (PHP)']];
      for(const p of data.payments||[])rows.push([p.reference_code,p.created_at,p.status,phpValue(p.amount_cents)]);
      downloadCsv('bouncebash-payments-'+dateSuffix+'.csv',rows);
    }
    if(status)status.textContent='CSV exported with amounts in Philippine pesos (PHP).';
  }
  function makePdfDocument(data){
    let paper=document.getElementById('bb-report-paper');
    if(!paper){paper=E('article','bb-report-paper');paper.id='bb-report-paper';document.body.append(paper);}
    const heading=E('header','bb-paper-head');heading.append(E('div','bb-paper-brand','BOUNCE BASH PH'),E('h1','', 'Booking & Collections Report'), E('p','',String(data.from)+' to '+String(data.to)+' · Philippine time'));
    const summary=E('section','bb-paper-summary');
    const count=(data.bookings||[]).length, t=data.totals||{};
    for(const [name,value] of [['Event bookings',String(count)],['Verified collections',peso(t.net_collections_cents||0)],['Active receivables',peso(t.outstanding_cents||0)],['Pending payment references',String(t.pending_references||0)]]){
      const card=E('div','bb-paper-stat');card.append(E('small','',name),E('strong','',value));summary.append(card);
    }
    function printedTable(title,headers,rows){
      const sec=E('section','bb-paper-section');sec.append(E('h2','',title));
      const table=E('table','bb-paper-table'),thead=E('thead'),tr=E('tr');
      for(const head of headers)tr.append(E('th','',head));thead.append(tr);table.append(thead);
      const body=E('tbody');
      if(!rows.length){const empty=E('tr'),td=E('td','', 'No records in this period.');td.colSpan=headers.length;empty.append(td);body.append(empty);}
      for(const row of rows){const tr=E('tr');for(const item of row)tr.append(E('td','',item));body.append(tr);}table.append(body);sec.append(table);return sec;
    }
    const bookings=(data.bookings||[]).map(b=>[b.reference_code,b.event_date,b.status,b.package_name,peso(b.total_cents),peso(b.balance_cents)]);
    const payments=(data.payments||[]).map(p=>[p.reference_code,p.created_at,p.status,peso(p.amount_cents)]);
    paper.replaceChildren(heading,summary,
      E('p','bb-paper-context','Booking totals use event dates; collection totals use payment receipt dates. These totals can differ within the same period.'),
      printedTable('Bookings',['Reference','Event date','Status','Rental','Total','Balance'],bookings),
      printedTable('Payments',['Reference','Received (UTC)','Status','Amount'],payments),
      E('footer','bb-paper-footer','Generated from BounceBash staff reports · PHP · '+new Date().toLocaleString('en-PH',{timeZone:'Asia/Manila'}))
    );
  }
  async function generatePdf(){
    const data=await currentData();makePdfDocument(data);
    if(status)status.textContent='Choose “Save as PDF” in the print dialog to download a text-based report.';
    document.body.classList.add('bb-report-printing');
    window.print();
  }
  window.addEventListener('afterprint',()=>document.body.classList.remove('bb-report-printing'));
  // Capture only the four report-period actions. Let all other Admin buttons
  // (including Apply filters, Refresh and Sign out) use the original handlers.
  document.addEventListener('click',event=>{
    const btn=event.target.closest?.('button');
    if(!btn||!host.contains(btn))return;
    const card=host.querySelector(':scope > section.card');
    if(!card||!card.contains(btn)||btn.closest('form'))return;
    const text=btn.textContent.trim();
    const presets={'Today':'day','This month':'month','This year':'year'};
    if(!Object.prototype.hasOwnProperty.call(presets,text) && !['Generate PDF','Export bookings CSV','Export payments CSV'].includes(text))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(btn.disabled)return;
    if(Object.prototype.hasOwnProperty.call(presets,text)){selectPeriod(presets[text]);return;}
    btn.disabled=true;
    const action=text==='Generate PDF'?generatePdf:()=>exportData(text==='Export bookings CSV'?'bookings':'payments');
    Promise.resolve().then(action).catch(e=>{if(status)status.textContent=e.message;}).finally(()=>{btn.disabled=false;});
  },true);
})();
