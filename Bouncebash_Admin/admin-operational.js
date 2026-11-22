'use strict';

(() => {
  const main=document.querySelector('[data-admin-page]');
  if(!main)return;
  const host=document.getElementById('admin-content');
  const status=document.getElementById('admin-message');
  const refreshed=document.getElementById('admin-refresh-time');
  const format=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'});
  const money=cents=>cents==null?'Awaiting quotation':format.format(cents/100);
  const manila=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'});
  const time=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'});
  const statuses=['pending','confirmed','completed','cancelled','expired'];
  const $=(tag,value,cls)=>{
    const node=document.createElement(tag);
    if(value!==undefined&&value!==null)node.textContent=value;
    if(cls)node.className=cls;
    return node;
  };
  function button(label,action,cls='btn'){
    const node=$('button',label,cls);node.type='button';
    node.addEventListener('click',async()=>{
      if(node.disabled)return;
      node.disabled=true;
      try{await action();}catch(error){(node.closest('dialog')?.querySelector('[data-modal-message]')||status).textContent=error.message;}
      finally{node.disabled=false;}
    });
    return node;
  }
  function link(label,url){const node=$('a',label,'btn');node.href=url;return node;}
  async function request(url,method='GET',body){
    const response=await fetch(url,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await response.json().catch(()=>({}));
    if(response.status===401){location.replace('login.html');throw new Error('Sign in again.');}
    if(!response.ok)throw new Error(data.error||'Request failed. Refresh or try again.');
    return data;
  }
  const api=(url,method,body)=>request('/api/operator'+url,method,body);
  const card=(title,...children)=>{const node=$('section',null,'card');node.append($('h2',title),...children);return node;};
  function table(headers,rows,empty){
    if(!rows.length)return $('p',empty||'No records.', 'mu');
    const wrap=$('div',null,'tw');
    const table=$('table');wrap.append(table);
    const head=table.createTHead().insertRow();
    for(const name of headers)head.append($('th',name));
    const body=table.createTBody();
    for(const row of rows){
      const tr=body.insertRow();
      for(const value of row){const td=tr.insertCell();value instanceof Node?td.append(value):td.textContent=value??'—';}
    }
    return wrap;
  }
  const field=(label,name,value='',type='text',options)=>{
    const labelNode=$('label',label,'fld');
    const control=$(options?'select':type==='textarea'?'textarea':'input',null,'inp');
    control.name=name;
    if(options)for(const option of options){
      const [key,text]=Array.isArray(option)?option:[option,option];
      control.add(new Option(text,key));
    }
    else if(type!=='textarea')control.type=type;
    if(type==='checkbox')control.checked=Boolean(value);else control.value=value??'';
    labelNode.append(control);
    return {label:labelNode,control};
  };
  function form(fields,label,action){
    const node=$('form',null,'admin-form');
    node.append(...fields.map(item=>item.label));
    const feedback=$('p',null,'mu');feedback.setAttribute('role','status');
    const submit=$('button',label,'btn dark');submit.type='submit';node.append(submit,feedback);
    node.addEventListener('submit',async event=>{
      event.preventDefault();if(submit.disabled)return;
      submit.disabled=true;feedback.textContent='Saving…';
      try{
        const values=Object.fromEntries(fields.map(({control})=>[control.name,control.type==='checkbox'?control.checked:control.value]));
        await action(values);
        feedback.textContent='Saved.';
      }catch(error){feedback.textContent=error.message;}
      finally{submit.disabled=false;}
    });
    return node;
  }
  let modalNumber=0;
  function modal(title,...children){
    const node=$('dialog',null,'card admin-dialog');
    const message=$('p',null,'mu');message.dataset.modalMessage='';message.setAttribute('role','status');
    const heading=$('h2',title);heading.id='admin-dialog-title-'+(++modalNumber);
    node.setAttribute('aria-labelledby',heading.id);
    node.append(heading,button('Close',()=>node.close()),message,...children);
    node.addEventListener('close',()=>node.remove(),{once:true});
    document.body.append(node);node.showModal();return node;
  }
  const query=values=>new URLSearchParams(Object.entries(values).filter(([,v])=>v!=='')).toString();
  const rowDetails=(labels)=>{const node=$('dl');for(const [label,value]of labels){node.append($('dt',label),$('dd',value??'—'));}return node;};
  const counts=[
    ['Bookings','bookings'],['Pending bookings','pending'],['Confirmed bookings','confirmed'],['Upcoming events','upcoming'],
    ['Net verified collections','net_collections_cents'],['Gross recorded collections','gross_collections_cents'],
    ['Externally recorded refunds','recorded_refunded_cents'],['Pending references','pending_references'],['Pending reference amounts','pending_reference_cents'],
    ['Known booking values','known_booking_value_cents'],['Active receivables','outstanding_cents'],
    ['Active unknown quotes','unknown_quotes'],['Unresolved inactive funds','unresolved_inactive_cents']
  ];
  function metrics(data){
    const grid=$('div',null,'grid admin-metrics');
    for(const [label,key]of counts){
      const amount=key.endsWith('_cents')?money(data[key]):data[key];
      grid.append(card(label,$('strong',amount)));
    }
    return grid;
  }
  function trend(payments){
    const months=new Map();
    for(const item of payments){
      if(!['verified','refunded'].includes(item.status))continue;
      const month=manila.format(new Date(item.created_at.slice(0,19).replace(' ','T')+'Z')).slice(0,7);
      const values=months.get(month)||{verified:0,refunded:0};
      values[item.status]+=item.amount_cents;months.set(month,values);
    }
    const max=Math.max(1,...[...months.values()].map(v=>v.verified+v.refunded));
    const chart=$('div',null,'admin-chart');
    for(const [month,values]of [...months].sort()){
      const bar=$('meter');bar.min=0;bar.max=max;bar.value=values.verified;bar.setAttribute('aria-label',month+' net verified collections');
      chart.append($('p',month+' · '+money(values.verified)+' verified · '+money(values.refunded)+' refunded'),bar);
    }
    if(!months.size)chart.textContent='No verified or refunded payments in this range.';
    return chart;
  }
  function exportCsv(name,rows){
    const escape=value=>{
      let text=String(value??'');
      if(/^[\s]*[=+@-]|^[\t\r]/.test(text))text="'"+text;
      return '"'+text.replaceAll('"','""')+'"';
    };
    const url=URL.createObjectURL(new Blob([rows.map(row=>row.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const download=$('a');download.href=url;download.download=name;download.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const bookingLink=ref=>link(ref,'bookings.html?reference='+encodeURIComponent(ref));
  const bookHeaders=['Reference','Customer','Event date','Time','State','Rental','Booking value','Verified','Pending','Balance'];
  const reportRow=b=>[bookingLink(b.reference_code),b.name,b.event_date,b.event_time,b.status,b.package_name,money(b.total_cents),money(b.verified_cents),money(b.pending_cents),money(b.balance_cents)];
  const reportFilters={from:'',to:'',status:''};
  async function overview(isReport){
    const data=await api('/overview?'+query(reportFilters));
    const output=[];
    if(isReport){
      const inputs=[field('From','from',reportFilters.from,'date'),field('Through','to',reportFilters.to,'date'),field('Booking status','status',reportFilters.status,'text',[['','All statuses'],...statuses])];
      const actions=$('div',null,'acts');
      for(const [label,key] of [['Today','day'],['This month','month'],['This year','year']])actions.append(button(label,()=>{
        const today=data.today;
        const start=key==='day'?today:key==='month'?today.slice(0,7)+'-01':today.slice(0,4)+'-01-01';
        Object.assign(reportFilters,{from:start,to:today});return refresh();
      }));
      actions.append(button('Generate PDF',()=>window.print()),button('Export bookings CSV',()=>exportCsv('bookings.csv',[
        ['Reference','Date','Time','Status','Rental','Total centavos','Verified centavos','Pending centavos','Balance centavos'],
        ...data.bookings.map(b=>[b.reference_code,b.event_date,b.event_time,b.status,b.package_name,b.total_cents,b.verified_cents,b.pending_cents,b.balance_cents])
      ])),button('Export payments CSV',()=>exportCsv('payments.csv',[
        ['Reference','Received at UTC','State','Amount centavos'],
        ...data.payments.map(p=>[p.reference_code,p.created_at,p.status,p.amount_cents])
      ])));
      output.push(card('Report period',form(inputs,'Apply filters',async values=>{Object.assign(reportFilters,values);await refresh();}),actions,
        $('p',data.from+' through '+data.to+' · Philippine time','mu')));
    }else output.push(link('New booking','bookings.html?new=1'),link('Review pending bookings','bookings.html?status=pending'));
    output.push(metrics(data.totals),card('Collection trends',trend(data.payments)));
    const bookings=isReport?data.bookings:data.bookings.filter(b=>b.upcoming).slice(0,12);
    output.push(card(isReport?'Booking list':'Upcoming events',table(bookHeaders,bookings.map(reportRow))));
    if(isReport){
      output.push(card('Payment breakdown',table(['Booking','Received (UTC)','State','Amount'],data.payments.map(p=>[
        bookingLink(p.reference_code),p.created_at,p.status,money(p.amount_cents)
      ]))));
      const groups=new Map();
      for(const b of data.bookings)groups.set(b.package_name,(groups.get(b.package_name)||0)+1);
      output.push(card('Bookings by rental',table(['Rental','Bookings'],[...groups])),card('Top add-ons',table(['Add-on','Quantity'],data.extras)),
        card('Feedback and blog',link('Manage articles and feedback','blog.html')));
    }else{
      const {events}=await api('/audit?limit=10');
      output.push(card('Recent activity',table(['Action','Record','Time'],(events||[]).map(x=>[x.action,x.entity,x.created_at]))));
    }
    host.replaceChildren(...output);
  }

  const bookingFilters={search:'',status:new URLSearchParams(location.search).get('status')||'',sort:'',payment:'',offset:0};
  async function showBooking(ref){
    const {booking:b}=await api('/bookings/'+encodeURIComponent(ref));
    const route='/bookings/'+encodeURIComponent(ref);
    const actions=$('div',null,'admin-stack');
    const node=modal('Booking '+ref,rowDetails([
      ['Customer',b.name],['Contact',b.contact_number],['Email',b.email],['Status',b.status],
      ['Date and time',b.event_date+' '+b.event_time+' Philippine time'],['Venue',b.venue],['Delivery location',b.city_id],
      ['Rental',b.quote?.model_name||b.package_name],['Variant',b.quote?.variant||b.selected_style],
      ['Duration',b.quote?.rental_hours==null?null:b.quote.rental_hours+' hours'],['Notes',b.notes],['Hold expiry',b.expires_at],
      ['Quote state',b.pricing_state],['Subtotal',money(b.subtotal_cents)],['Total',money(b.total_cents)],
      ['Deposit',money(b.deposit_cents)],['Verified',money(b.paid_cents)],['Balance',money(b.balance_cents)],
      ['Add-ons',JSON.stringify(b.selection?.length?b.selection:b.add_ons)],['Quotation snapshot',JSON.stringify(b.quote)]
    ]),actions);
    async function save(url,body,method='PUT'){
      await api(url,method,body);node.close();await refresh();await showBooking(ref);
    }
    if(b.status==='pending')actions.append(card('Final quotation',form([
      field('Total pesos','total',b.total_cents==null?'':(b.total_cents/100).toFixed(2)),
      field('Quotation explanation','note',b.quote?.note,'textarea')
    ],'Save quotation',values=>save(route+'/quote',values))),
    button('Confirm booking',()=>save(route+'/status',{status:'confirmed'}),'btn dark'));
    if(['pending','confirmed'].includes(b.status)){
      actions.append(card('Reschedule',form([field('Date','eventDate',b.event_date,'date'),field('Time','eventTime',b.event_time,'time')],
        'Request reschedule',values=>save(route+'/reschedule',values,'POST'))));
      actions.append(card('Cancellation',form([field('Reason','reason','','textarea')],'Cancel booking',values=>save(route+'/status',{...values,status:'cancelled'}))));
    }
    if(b.status==='confirmed')actions.append(button('Mark completed',()=>save(route+'/status',{status:'completed'})));
    if(['pending','confirmed'].includes(b.status) && b.pricing_state==='final' && b.balance_cents>0){
      actions.append(card('Record payment reference',form([
        field('Amount (PHP)','amount'),field('Transaction reference','reference'),
        field('Method','method','GCash','text',['GCash','Bank transfer','Cash'])
      ],'Record for verification',values=>save(route+'/payments',values,'POST'))));
    }
    actions.append(card('Payments',table(['Method','Reference','Amount','State','Action'],b.payments.map(p=>{
      const cell=$('div');
      if(p.proof_id)cell.append(link('Download proof','/api/operator/payments/'+p.id+'/proof'));
      const transitions=p.status==='pending'?[['verified','Verify'],['rejected','Reject']]:
        p.status==='verified'&&['cancelled','expired'].includes(b.status)?[['refunded','Record external refund']]:[];
      for(const [target,label]of transitions)cell.append(button(label,()=>{
        const action=modal(label,form([field('Audit note','note','','textarea')],label,async values=>{
          await api('/payments/'+p.id,'PUT',{...values,status:target});action.close();node.close();await refresh();await showBooking(ref);
        }));
      }));
      return [p.method,p.reference,money(p.amount_cents),p.status,cell];
    }))));
  }
  function newBooking(catalog){
    const bookable=catalog.models.flatMap(model=>{
      if(!model.is_active)return [];
      const links=catalog.packageModels.filter(link=>link.model_id===model.id);
      const packageId=model.booking_package_id||(links.length===1?links[0].package_id:null);
      const offer=catalog.packages.find(p=>p.id===packageId&&p.is_active&&Number.isInteger(p.rental_hours)&&Number.isInteger(p.base_price_cents));
      return offer&&links.some(link=>link.package_id===packageId)?[{...model,packageId}]:[];
    });
    if(!bookable.length)throw new Error('Configure a priced rental before adding a booking.');
    const model=field('Rental','rentalId',bookable[0].id,'text',bookable.map(m=>[m.id,m.name]));
    const variant=field('Variant','variantId');
    const select=$('select',null,'inp');select.name='variantId';variant.control.replaceWith(select);variant.control=select;
    const variants=()=>{
      select.replaceChildren();
      const compatible=catalog.variants.filter(v=>v.is_active&&String(v.model_id)===model.control.value);
      if(!compatible.length)select.add(new Option('Standard',''));
      for(const item of compatible)select.add(new Option(item.name,item.id));
    };
    variants();model.control.addEventListener('change',variants);
    const node=modal('New staff booking',$('p','Staff-entered bookings are recorded without a customer login association.','mu'),
      form([field('Customer name','name'),field('Phone','contact'),field('Email (optional)','email','','email'),
        field('Date','eventDate','','date'),field('Time','eventTime','','time'),field('Venue','venue'),
        field('NCR city','cityId',catalog.cities[0].id,'text',catalog.cities.map(c=>[c.id,c.name])),model,variant,
        field('Additional hours','extraHours',0,'number'),field('Notes','notes','','textarea'),
        field('Customer accepted the deposit policy','reservationFeeAccepted',false,'checkbox')],'Create booking',async values=>{
          const selected=bookable.find(item=>String(item.id)===values.rentalId);
          const result=await api('/bookings','POST',{...values,packageId:selected?.packageId});node.close();await refresh();await showBooking(result.booking.reference);
        }));
  }
  async function bookings(){
    const pageSize=25;
    const [data,inquiries]=await Promise.all([
      api('/bookings?'+query({...bookingFilters,limit:pageSize})),
      api('/inquiries?limit=200')
    ]);
    const inputs=[field('Search reference, customer or phone','search',bookingFilters.search),
      field('Booking status','status',bookingFilters.status,'text',[['','All statuses'],...statuses]),
      field('Sort','sort',bookingFilters.sort,'text',[['','Newest created'],['soonest','Earliest event'],['latest','Latest event']]),
      field('Payment','payment',bookingFilters.payment,'text',[['','Any payment'],['unpaid','Unpaid'],['balance','Balance due'],['paid','Paid in full'],['pending','Awaiting verification']])];
    const controls=$('div',null,'acts');
    const openNew=async()=>{const [catalog,publicCatalog]=await Promise.all([api('/catalog'),request('/api/catalog')]);newBooking({...catalog,cities:publicCatalog.cities});};
    controls.append(button('New booking',openNew,'btn dark'));
    if(bookingFilters.offset)controls.append(button('Previous',()=>{bookingFilters.offset-=pageSize;return refresh();}));
    if(bookingFilters.offset+pageSize<data.total)controls.append(button('Next',()=>{bookingFilters.offset+=pageSize;return refresh();}));
    const queue=inquiries.inquiries.map(inquiry=>{
      const details=JSON.parse(inquiry.details);
      const open=button('Inquiry '+inquiry.id,()=>{
        const actions=$('div');
        const node=modal('Inquiry '+inquiry.id,rowDetails([['Customer',inquiry.name],['Contact',inquiry.contact],['Requested date',details.eventDate],['Rental',details.packageName],['Notes',details.notes],['Reply',inquiry.reply]]),actions);
        if(inquiry.status!=='converted')actions.append(form([field('Reply','reply',inquiry.reply,'textarea')],'Record reply',async values=>{
          await api('/inquiries/'+inquiry.id+'/reply','POST',values);node.close();await refresh();
        }),form([field('Customer acknowledged deposit','customerAcceptedFee',false,'checkbox')],'Convert to booking',async values=>{
          const result=await api('/inquiries/'+inquiry.id+'/convert','POST',values);node.close();await refresh();await showBooking(result.booking.reference);
        }));
      });
      return [open,inquiry.name,details.eventDate,inquiry.status];
    });
    host.replaceChildren(form(inputs,'Apply filters',async values=>{Object.assign(bookingFilters,values,{offset:0});await refresh();}),controls,
      card(data.total+' bookings',table(['Reference','Customer','Date','Rental','Status','Total','Balance'],data.bookings.map(b=>[
        button(b.reference,()=>showBooking(b.reference)),b.name,b.event_date+' '+b.event_time,b.package_name,b.status,money(b.total_cents),money(b.balance_cents)
      ]))),card('Inquiry queue · no date holds',table(['Inquiry','Customer','Requested date','State'],queue)));
    const url=new URL(location.href);
    if(url.searchParams.has('reference')||url.searchParams.has('new')){
      const ref=url.searchParams.get('reference');
      url.searchParams.delete('reference');url.searchParams.delete('new');history.replaceState(null,'',url);
      if(ref)await showBooking(ref);else await openNew();
    }
  }

  const calendarState={month:manila.format(new Date()).slice(0,7),date:manila.format(new Date())};
  async function calendar(){
    const [year,month]=calendarState.month.split('-').map(Number);
    const prefix=calendarState.month+'-';
    const days=new Date(Date.UTC(year,month,0)).getUTCDate();
    const [availability,rows,blocked]=await Promise.all([
      request('/api/availability/month?year='+year+'&month='+month),
      api('/bookings?from='+prefix+'01&to='+prefix+days+'&limit=200'),
      api('/date-blocks')
    ]);
    const actions=$('div',null,'acts');const picker=field('Month','month',calendarState.month,'month');
    actions.append(...[-1,1].map(delta=>button(delta===1?'Next month':'Previous month',()=>{
      calendarState.month=new Date(Date.UTC(year,month-1+delta,1)).toISOString().slice(0,7);
      calendarState.date=calendarState.month+'-01'; return refresh();
    })));
    actions.append(form([picker],'Go to month',async values=>{
      if(!/^\d{4}-\d{2}$/.test(values.month))throw new Error('Select a month.');
      calendarState.month=values.month;calendarState.date=values.month+'-01';await refresh();
    }));
    const grid=$('div',null,'cal');
    for(const day of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])grid.append($('b',day));
    for(let i=0;i<new Date(Date.UTC(year,month-1,1)).getUTCDay();i++)grid.append($('div',null,'day empty'));
    const left=card(new Intl.DateTimeFormat('en-PH',{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(Date.UTC(year,month-1,1))),actions,grid);
    const right=card(calendarState.date);
    function select(day){
      calendarState.date=day;right.replaceChildren($('h2',day));
      const block=blocked.blocks.find(x=>x.event_date===day);
      const records=rows.bookings.filter(x=>x.event_date===day);
      right.append(table(['Booking','Customer','Time','Status'],records.map(b=>[button(b.reference,()=>showBooking(b.reference)),b.name,b.event_time,b.status]),'No bookings on this date.'));
      if(block)right.append($('p','Blocked: '+block.reason),button('Unblock date',async()=>{await api('/date-blocks/'+day+'/remove','POST',{});await refresh();}));
      else if(!availability.unavailableDates.some(entry=>entry.date===day))right.append(form([field('Reason','reason')],'Block date',async values=>{
        await api('/date-blocks','POST',{date:day,...values});await refresh();
      }));
    }
    for(let day=1;day<=days;day++){
      const date=prefix+String(day).padStart(2,'0');
      const cell=button(String(day),()=>select(date),'day');
      const busy=availability.unavailableDates.some(entry=>entry.date===date);
      if(busy)cell.append($('span',blocked.blocks.some(x=>x.event_date===date)?'Blocked':'Reserved','ev p1'));
      cell.setAttribute('aria-label',date+(busy?' unavailable':' available'));grid.append(cell);
    }
    select(calendarState.date);
    const wrap=$('div',null,'grid calwrap admin-calendar');wrap.append(left,right);host.replaceChildren(wrap);
  }

  async function catalog(){
    const [data,policy]=await Promise.all([api('/catalog'),api('/pricing-policy')]);
    const modelOptions=data.models.map(m=>[m.id,m.name]);
    const zoneOptions=data.zones.map(z=>[z.id,z.name]);
    const packageOptions=[['','Choose a package'],...data.packages.map(p=>[p.id,p.name])];
    const saveClose=async(node,url,method,values)=>{await api(url,method,values);node.close();await refresh();};
    function editPackage(p){
      const node=modal(p.name,
        form([field('Description','description',p.description,'textarea'),field('Available','active',p.is_active,'checkbox')],'Save availability',
          values=>saveClose(node,'/catalog/packages/'+p.id,'PUT',values)),
        form([field('Price in pesos','price',p.base_price_cents==null?'':p.base_price_cents/100),
          field('Included hours','hours',p.rental_hours,'number'),field('Inclusions, one per line','inclusions',JSON.parse(p.inclusions||'[]').join('\n'),'textarea'),
          field('Compatible model IDs, comma separated','modelIds',(data.packageModels||[]).filter(x=>x.package_id===p.id).map(x=>x.model_id).join(','))],
          'Save package pricing',values=>saveClose(node,'/catalog/packages/'+p.id+'/pricing','PUT',{
            ...values,inclusions:values.inclusions.split('\n').map(x=>x.trim()).filter(Boolean),
            modelIds:values.modelIds.split(',').map(x=>x.trim()).filter(Boolean)
          })));
    }
    function editModel(model){
      const fields=[field('Name','name',model?.name),field('Zone','zoneId',model?.zone_id||zoneOptions[0]?.[0],'text',zoneOptions),
        field('Capacity','capacity',model?.capacity||10,'number'),field('Image under /assets/photos','imageUrl',model?.image_url),
        field('Description','description',model?.description,'textarea'),field('Includes balls','includesBalls',model?.includes_balls,'checkbox'),
        field('Active','active',model?.is_active??true,'checkbox'),
        field('Booking offer','packageId',model?.booking_package_id||'','text',packageOptions)];
      const node=modal(model?'Edit rental model':'Add rental model',form(fields,'Save rental model',
        values=>saveClose(node,'/catalog/models'+(model?'/'+model.id:''),model?'PUT':'POST',values)));
    }
    const packageControls=button('Add package',()=>{
      const node=modal('Add package',form([field('Name','name'),field('Description','description','','textarea')],'Add package',
        values=>saveClose(node,'/catalog/packages','POST',values)));
    },'btn dark');
    const variantControls=button('Add variant',()=>{
      const node=modal('Add variant',form([field('Model','modelId',modelOptions[0]?.[0],'text',modelOptions),field('Variant name','name')],
        'Add variant',values=>saveClose(node,'/catalog/variants','POST',values)));
    });
    const feeFields=[field('Extra hour (centavos)','extraHourCents',policy.extraHourCents,'number'),
      field('Balloon arch (centavos)','archCents',policy.extras['Balloon arch'],'number'),
      field('Backdrop (centavos)','backdropCents',policy.extras['Backdrop & signage'],'number'),
      ...policy.cities.map(city=>field(city.name+' delivery (centavos)',city.id,city.delivery_cents,'number'))];
    host.replaceChildren(card('Package offers',packageControls,table(['Package','Price','Hours','Active','Action'],data.packages.map(p=>[
      p.name,money(p.base_price_cents),p.rental_hours,p.is_active?'Yes':'No',button('Edit',()=>editPackage(p))
    ]))),card('Photographed rentals',button('Add rental model',()=>editModel()),table(['ID','Rental','Image','Active','Action'],data.models.map(m=>[
      m.id,m.name,m.image_url,m.is_active?'Yes':'No',button('Edit',()=>editModel(m))
    ]))),card('Compatible variants',variantControls,table(['Rental','Variant','Active','Action'],data.variants.map(v=>[
      data.models.find(m=>m.id===v.model_id)?.name,v.name,v.is_active?'Yes':'No',button(v.is_active?'Deactivate':'Activate',async()=>{
        await api('/catalog/variants/'+v.id,'PUT',{active:!v.is_active});await refresh();
      })
    ]))),card('Applicable extras and delivery',
      $('p','Ball color is free for eligible rentals. Setup and pickup are included.','mu'),
      form(feeFields,'Save prices',async values=>{
        await api('/pricing-policy','PUT',{...values,delivery:Object.fromEntries(policy.cities.map(city=>[city.id,values[city.id]]))});await refresh();
      })));
  }

  async function blog(){
    const [{articles},{reviews}]=await Promise.all([api('/articles'),api('/reviews')]);
    function editArticle(article){
      const slug=field('URL slug','slug',article?.slug);slug.control.readOnly=!!article;
      const copy=$('div');
      if(article)copy.append($('p','Leave the replacement body empty to retain the existing formatting and text.','mu'),$('pre',article.blocks.map(flatten).join('')));
      const node=modal(article?'Edit article':'New article',copy,form([
        slug,field('Title','title',article?.title),field('Summary','summary',article?.summary,'textarea'),field('Category','category',article?.category),
        field('Publication label','dateLabel',article?.date_label),field('Image path','image',article?.image),field('Image description','imageAlt',article?.image_alt),
        field(article?'Replacement body':'Body','body','','textarea'),field('Visibility','state',article?.state||'draft','text',['draft','published','archived'])
      ],'Save article',async values=>{
        if(article&&!values.body)delete values.body;
        await api('/articles/'+encodeURIComponent(values.slug),'PUT',{...values,revision:article?.revision||0});node.close();await refresh();
      }));
    }
    function flatten(item){return typeof item==='string'?item:(item.children||[]).map(flatten).join('')+'\n';}
    function moderate(r){
      const node=modal('Review '+r.id,rowDetails([['Author',r.name],['Original customer text',r.message],['Consent',r.can_feature?'Recorded':'Absent'],['Current moderation',r.moderation_status]]),
        form([field('Moderation','status',r.moderation_status,'text',['pending','approved','rejected'])],'Save moderation',async values=>{
          await api('/reviews/'+r.id,'PUT',values);node.close();await refresh();
        }),form([field('Public editorial correction','correction',r.correction,'textarea'),
          field('Feature on homepage','featured',r.featured??(r.can_feature&&r.moderation_status==='approved'),'checkbox'),
          field('Archive','archived',r.archived,'checkbox')],'Save presentation',async values=>{
          await api('/reviews/'+r.id+'/editorial','PUT',values);node.close();await refresh();
        }));
    }
    host.replaceChildren(card('Blog posts',button('New post',()=>editArticle(),'btn dark'),
      table(['Title','Publication label','State','Source','Actions'],articles.map(a=>[
        a.title,a.date_label,a.state,a.provenance,button('Edit',()=>editArticle(a))
      ]))),card('Customer feedback',table(['Author','Rating','Moderation','Consent','Archived','Action'],reviews.map(r=>[
        r.name,r.rating,r.moderation_status,r.can_feature?'Yes':'No',r.archived?'Yes':'No',button('Review',()=>moderate(r))
      ]))));
  }
  async function settings(){
    const [{settings:stored},notifications,{preferences}]=await Promise.all([api('/business-settings'),api('/notifications'),api('/staff-notices')]);
    const contact=stored?.contact||{}, payment=stored?.payment||{},bank=payment.bank||{},cash=payment.cash||{};
    host.replaceChildren(card('Business details and public payment instructions',form([
      field('Business name','name',contact.name),field('Email','email',contact.email,'email'),
      field('Phone','phone',contact.phone,'tel'),field('Service area','area',contact.area),field('Booking hours','hours',contact.hours),
      field('GCash visibility','gcashMode','keep','text',[['keep','Keep current instructions'],['disabled','Hide GCash'],['enabled','Publish configured GCash details']]),
      field('GCash receiving name','gcashName',payment.gcash?.name),field('GCash receiving number','gcashNumber',payment.gcash?.number),
      field('Confirmation notice','paymentNote',payment.note,'textarea'),field('Approved bank transfer','bankApproved',bank.businessApproved,'checkbox'),
      field('Bank name','bankName',bank.bankName),field('Bank account name','bankAccountName',bank.accountName),
      field('Bank account number','bankAccountNumber',bank.accountNumber),field('Approved cash','cashApproved',cash.businessApproved,'checkbox'),
      field('Cash instructions','cashInstructions',cash.instructions,'textarea')
    ],'Save settings',async values=>{await api('/business-settings','PUT',values);await refresh();})),
    card('Booking rules',$('p','One active booking per date. A pending hold lasts three hours. The deposit is 50% of the final quote. Payment references require staff verification.')),
    card('Notifications',$('p',notifications.provider_configured?'Delivery bridge configured.':'Delivery bridge is unconfigured.'),
      form([
        field('New booking','newBooking',preferences.newBooking,'checkbox'),
        field('Payment reference awaiting verification','paymentReceived',preferences.paymentReceived,'checkbox'),
        field('Confirmed event reminder two days before','eventReminder',preferences.eventReminder,'checkbox'),
        field('Feedback awaiting moderation','newReview',preferences.newReview,'checkbox'),
        field('Monday weekly summary','weeklySummary',preferences.weeklySummary,'checkbox')
      ],'Save my notification preferences',async values=>{await api('/staff-notices','PUT',values);await refresh();}),
      table(['Type','State','Attempts','Last error','Action'],notifications.notifications.map(n=>[
        n.kind,n.status,n.attempts,n.last_error,n.status==='failed'?button('Queue retry',async()=>{
          await api('/notifications/'+n.id+'/retry','POST',{});await refresh();
        }):null
      ]))));
  }
  const pages={index:()=>overview(false),reports:()=>overview(true),bookings,calendar,packages:catalog,blog,settings};
  let loading=false;
  async function refresh(){
    if(loading)return;
    loading=true;
    status.textContent='Loading…';
    try{
      await pages[main.dataset.adminPage]();
      refreshed.textContent='Updated '+time.format(new Date())+' (PH)';
      status.textContent='';
    }catch(error){
      status.textContent=(host.childElementCount?'Showing previous results. ':'')+error.message;
    }finally{loading=false;}
  }
  document.getElementById('admin-refresh').addEventListener('click',refresh);
  document.getElementById('admin-sign-out').addEventListener('click',async()=>{
    try{await request('/api/staff/logout','POST',{});location.replace('login.html');}
    catch(error){status.textContent=error.message;}
  });
  request('/api/staff/session').then(user=>{
    if(!user.authenticated){location.replace('login.html');return;}
    document.getElementById('staff-name').textContent=user.name;
    return refresh();
  }).catch(error=>{status.textContent=error.message;});
})();

