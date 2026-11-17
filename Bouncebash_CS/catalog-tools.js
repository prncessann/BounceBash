'use strict';
function displayPrice(cents){return cents===null || cents===undefined ? 'Request a quote':new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(cents/100);}
function selectedBookingItems(){
  return Array.from(document.querySelectorAll('#booking-addons input[name="addons"]:checked')).map(box=>{
    const row=box.closest('[data-addon-row]');
    return {name:box.value,quantity:Number(row.querySelector('[data-quantity]').value),optionId:row.querySelector('[data-option]')?.value || null};
  });
}
function configureBookingCatalog(data){
  const zone=document.getElementById('booking-zone'),model=document.getElementById('booking-model'),variant=document.getElementById('booking-variant'),pkg=document.getElementById('package');
  if(!zone||!model||!variant)return;
  zone.replaceChildren(new Option('Any zone / team to advise',''),...data.zones.map(z=>new Option(z.name,String(z.id))));
  const params=new URLSearchParams(location.search);const requestedZone=data.zones.find(z=>z.slug===params.get('zone'));if(requestedZone)zone.value=String(requestedZone.id);
  function variants(){const rows=data.variants.filter(v=>v.model_id===Number(model.value));variant.replaceChildren(new Option(rows.length?'Choose a variant':'No variant required',''),...rows.map(v=>new Option(v.name,String(v.id))));variant.required=rows.length>0;}
  function models(){
    const packageRecord=data.packages.find(p=>p.name===pkg.value);
    const eligible=data.models.filter(m=>(!zone.value||m.zone_id===Number(zone.value))&&(!packageRecord||data.packageModels.some(link=>link.package_id===packageRecord.id&&link.model_id===m.id)));
    model.replaceChildren(new Option(eligible.length?'Choose a rental model':'Team to advise / no configured models',''),...eligible.map(m=>new Option(`${m.name} (up to ${m.capacity} children)`,String(m.id))));
    model.required=eligible.length>0;variants();
  }
  zone.addEventListener('change',models);pkg.addEventListener('change',models);model.addEventListener('change',variants);
  // Keep the existing package preselection set by site.js.
  setTimeout(()=>{models();if(params.get('modelId')){model.value=params.get('modelId');variants();}},0);
  const target=document.getElementById('booking-addons');
  target.replaceChildren(...data.addOns.map(addon=>{
    const row=document.createElement('div');row.className='field';row.dataset.addonRow='';
    const label=document.createElement('label');const box=document.createElement('input');box.type='checkbox';box.name='addons';box.value=addon.name;
    label.append(box,document.createTextNode(` ${addon.name} · ${displayPrice(addon.unit_price_cents)}`));
    const qtyLabel=document.createElement('label');qtyLabel.textContent='Quantity';const qty=document.createElement('input');qty.type='number';qty.min='1';qty.max=String(addon.max_quantity);qty.value='1';qty.dataset.quantity='';qty.disabled=true;qtyLabel.append(qty);row.append(label,qtyLabel);
    const choices=data.options.filter(o=>o.add_on_id===addon.id);
    if(choices.length){const optionLabel=document.createElement('label');optionLabel.textContent='Color / decoration option';const select=document.createElement('select');select.dataset.option='';select.disabled=true;select.replaceChildren(new Option('Choose an option',''),...choices.map(o=>new Option(o.name,String(o.id))));optionLabel.append(select);row.append(optionLabel);}
    box.addEventListener('change',()=>{qty.disabled=!box.checked;qty.required=box.checked;const select=row.querySelector('select');if(select){select.disabled=!box.checked;select.required=box.checked;}});return row;
  }));
  document.getElementById('booking-form').addEventListener('reset',()=>queueMicrotask(()=>{
    target.querySelectorAll('input[name="addons"]').forEach(box=>{
      const row=box.closest('[data-addon-row]');const qty=row.querySelector('[data-quantity]');qty.disabled=!box.checked;qty.required=box.checked;
      const option=row.querySelector('[data-option]');if(option){option.disabled=!box.checked;option.required=box.checked;}
    });
    models();document.getElementById('reservation-fee').required=true;
    document.querySelector('#booking-form button[type="submit"]').textContent='Submit Booking Request';
    document.getElementById('quote-message').textContent='';
  }));
  document.getElementById('request-type').addEventListener('change',event=>{const inquiry=event.target.value==='inquiry';document.getElementById('reservation-fee').required=!inquiry;document.querySelector('#booking-form button[type="submit"]').textContent=inquiry?'Send Inquiry':'Submit Booking Request';});
  document.getElementById('preview-quote').addEventListener('click',async event=>{
    event.preventDefault();const message=document.getElementById('quote-message');event.target.disabled=true;
    try{const d=await apiRequest('/api/quotes',{method:'POST',body:JSON.stringify({packageName:pkg.value,children:document.getElementById('children').value,modelId:model.value||null,variantId:variant.value||null,addOnItems:selectedBookingItems()})});message.textContent=`Catalog quote: ${displayPrice(d.quote.total_cents)}. 50% deposit: ${displayPrice(d.quote.deposit_cents)}. Rental: ${d.quote.rental_hours} hours. ${d.quote.delivery_note}`;}
    catch(e){message.textContent=e.message;}finally{event.target.disabled=false;}
  });
}
document.addEventListener('DOMContentLoaded',async()=>{
  document.querySelectorAll('a.social[href=""]').forEach(a=>{a.hidden=true;a.setAttribute('aria-disabled','true');});
  const path=location.pathname;
  if(!['/packages.html','/add-ons.html','/styles.html','/rentals.html'].some(p=>path.endsWith(p)))return;
  try{
    const data=await apiRequest('/api/catalog');
    if(path.endsWith('/packages.html')){
      document.querySelectorAll('.package-card').forEach(card=>{const p=data.packages.find(p=>p.name===card.querySelector('h3')?.textContent.trim());if(!p){card.hidden=true;return;}const price=card.querySelector('.price');if(price)price.textContent=displayPrice(p.base_price_cents);const ul=card.querySelector('ul');if(ul){const inclusions=JSON.parse(p.inclusions);ul.replaceChildren(...(inclusions.length?inclusions:['Inclusions awaiting confirmation']).map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));const li=document.createElement('li');li.textContent=p.rental_hours ? `${p.rental_hours} rental hours`:'Rental duration: request details';ul.append(li);}});
      const parent=document.querySelector('.package-card')?.parentElement;
      if(parent)for(const p of data.packages){if(Array.from(parent.querySelectorAll('.package-card h3')).some(h=>h.textContent.trim()===p.name))continue;
        const card=document.createElement('div');card.className='package-card';const h=document.createElement('h3');h.textContent=p.name;
        const description=document.createElement('p');description.textContent=p.description||'';const price=document.createElement('p');price.className='price';price.textContent=displayPrice(p.base_price_cents);
        const list=document.createElement('ul');for(const value of [...JSON.parse(p.inclusions),p.rental_hours?`${p.rental_hours} rental hours`:'Rental duration: request details']){const li=document.createElement('li');li.textContent=value;list.append(li);}
        const book=document.createElement('a');book.className='btn btn-dark';book.href='booking.html?package='+encodeURIComponent(p.name);book.textContent='Request this package';card.append(h,description,price,list,book);parent.append(card);
      }
      const table=document.querySelector('table');if(table){const head=document.createElement('thead'),tr=document.createElement('tr');for(const text of ['Package','Price','Rental hours']){const th=document.createElement('th');th.textContent=text;tr.append(th);}head.append(tr);const body=document.createElement('tbody');for(const p of data.packages){const row=document.createElement('tr');for(const value of [p.name,displayPrice(p.base_price_cents),p.rental_hours||'To confirm']){const td=document.createElement('td');td.textContent=String(value);row.append(td);}body.append(row);}table.replaceChildren(head,body);}
    }
    if(path.endsWith('/add-ons.html')){
      document.querySelectorAll('.addon-card').forEach(card=>{const p=data.addOns.find(a=>a.name.toLowerCase()===card.querySelector('h3')?.textContent.trim().toLowerCase());const price=card.querySelector('.price');if(price)price.textContent=p ? displayPrice(p.unit_price_cents):'Currently unavailable';});
      const parent=document.querySelector('.addon-card')?.parentElement;
      if(parent)for(const addon of data.addOns){if(Array.from(parent.querySelectorAll('.addon-card h3')).some(h=>h.textContent.trim().toLowerCase()===addon.name.toLowerCase()))continue;
        const card=document.createElement('div');card.className='addon-card';const h=document.createElement('h3');h.textContent=addon.name;const price=document.createElement('p');price.className='price';price.textContent=displayPrice(addon.unit_price_cents);const description=document.createElement('p');description.textContent=addon.description||'Select an available option in the booking form.';card.append(h,price,description);parent.append(card);
      }
      const swatches=document.querySelector('.swatch-row');if(swatches){const ball=data.addOns.find(a=>a.name==='Ball colors');const options=data.options.filter(o=>o.add_on_id===ball?.id);swatches.replaceChildren(...(options.length?options.map(o=>o.name):['Ask the team for currently available ball colors.']).map(text=>{const span=document.createElement('span');span.className='tag';span.textContent=text;return span;}));}
    }
    if(path.endsWith('/rentals.html'))document.querySelectorAll('.zone').forEach((card,index)=>{const slug=['dry','splash','ball-pit'][index];card.querySelectorAll('a[href="styles.html"]').forEach(a=>{a.href='styles.html?zone='+slug;});});
    if(path.endsWith('/styles.html')){
      const slug=new URLSearchParams(location.search).get('zone');const zone=data.zones.find(z=>z.slug===slug);const rows=data.models.filter(m=>!zone||m.zone_id===zone.id);const lead=document.querySelector('.page-header .lead');if(lead)lead.textContent=zone?`Available rental models for ${zone.name}. Choose a model, then its supported variant when booking.`:'Choose a configured rental model. Supported variants are selected in the booking form.';
      const grid=document.querySelector('.card-grid');if(grid){grid.replaceChildren(...rows.map(m=>{const card=document.createElement('div');card.className='style-card';if(m.image_url){const img=document.createElement('img');img.src=m.image_url;img.alt=m.name;card.append(img);}const h=document.createElement('h3');h.textContent=m.name;const description=document.createElement('p');description.textContent=m.description;const cap=document.createElement('p');cap.textContent=`Capacity: ${m.capacity} children`;const link=document.createElement('a');link.className='btn btn-dark';link.href='booking.html?'+new URLSearchParams({modelId:m.id,...(zone?{zone:zone.slug}:{})});link.textContent='Select this model';card.append(h,description,cap,link);return card;}));if(!rows.length){const p=document.createElement('p');p.textContent='Rental models have not been configured for this zone yet. Send an inquiry and the team can advise.';grid.append(p);}}
      document.querySelectorAll('.filter-pills,.filter-radio').forEach(n=>{n.hidden=true;});
    }
  }catch(e){const p=document.createElement('p');p.className='card';p.setAttribute('role','status');p.textContent='Current catalog could not be loaded. Please refresh or contact the team.';document.querySelector('.page-header')?.append(p);document.querySelectorAll('.price').forEach(n=>{n.textContent='Temporarily unavailable';});}
});
