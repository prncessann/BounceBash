'use strict';
// Agreed demonstration rates. Location IDs are stable, never client-supplied prices.
const cities = [
 ['quezon-city','Quezon City',200], ['caloocan','Caloocan',300], ['las-pinas','Las Piñas',400],
 ['makati','Makati',400], ['malabon','Malabon',300], ['mandaluyong','Mandaluyong',300], ['manila','Manila',300],
 ['marikina','Marikina',300], ['muntinlupa','Muntinlupa',400], ['navotas','Navotas',400], ['paranaque','Parañaque',400],
 ['pasay','Pasay',400], ['pasig','Pasig',300], ['pateros','Pateros',400], ['san-juan','San Juan',300], ['taguig','Taguig',400], ['valenzuela','Valenzuela',300],
].map(([id,name,pesos])=>({id,name,delivery_cents:pesos*100}));
const events=['Birthday','Christening','Baby Shower','Graduation','School Event','Corporate Event','Other'];
const colors=['White','Cream','Champagne','Blush','Sage','Lavender','Sky Blue','Yellow','Red','Royal Blue'];
const excluded=['Table styling','Balloon garland','Extra hour'];
const extraHourCents=60000;
const publicLabel=value=>String(value||'').replace(/\s*\(sample\)/gi,'').replace(/\bsample\b/gi,'').replace(/\s{2,}/g,' ').trim();
function domain({db,fail,text,optional,integer,loadPricing}) {
 async function select(body) {
  let pkg;
  let model=null;
  const id=body.rentalId ?? body.modelId;
  if(id!==undefined&&id!==null&&id!=='') {
   const modelId=integer(id,'Rental item',1,1000000);
   model=await db.prepare('SELECT * FROM rental_models WHERE id=? AND is_active=1').get(modelId);
   if(!model)fail(400,'Choose an available rental item.');
   // Item-first booking uses its explicit configured package ID. The UI never asks for two duplicate selections.
   const packageId=body.packageId ? integer(body.packageId,'Rental offer',1,1000000):model.booking_package_id;
   if(!packageId)fail(409,'This rental needs an operator-configured offer before it can be booked.');
   pkg=await db.prepare('SELECT p.* FROM packages p JOIN package_models pm ON pm.package_id=p.id WHERE p.id=? AND pm.model_id=? AND p.is_active=1').get(packageId,modelId);
   if(!pkg)fail(400,'This rental and offer are not compatible.');
  } else {
   // Preserve an API adapter for older, explicitly configured offers. New UI selects an item.
   const name=text(body.packageName||body.package_name||body.package,'Rental',1,120);
   pkg=await db.prepare('SELECT * FROM packages WHERE name=? AND is_active=1').get(name);
   if(!pkg)fail(400,'Selected rental is not active.');
   if(await db.prepare('SELECT 1 FROM package_models pm JOIN rental_models m ON m.id=pm.model_id WHERE pm.package_id=? AND m.is_active=1').get(pkg.id))fail(400,'Choose the actual rental item.');
  }
  let variant=null;const variantId=body.variantId===undefined||body.variantId===null||body.variantId===''?null:integer(body.variantId,'Style/color',1,1000000);
  if(variantId){variant=await db.prepare('SELECT * FROM model_variants WHERE id=? AND model_id=? AND is_active=1').get(variantId,model?model.id:0);if(!variant)fail(400,'Choose a supported style/color for this item.');}
  if(model&&!variantId&&await db.prepare('SELECT 1 FROM model_variants WHERE model_id=? AND is_active=1').get(model.id))fail(400,'Choose a style/color.');
  const pricing=await loadPricing();
  const city=pricing.cities.find(c=>c.id===body.cityId);if(!city)fail(400,'Choose a valid NCR city/municipality.');
  const extraHours=integer(body.extraHours??0,'Additional hours',0,12);
  const notes=optional(body.notes,'Notes',3000);
  const includesBalls=!!model?.includes_balls || pkg.name==='Ball Pit Bash';
  const raw=body.addOnItems??(Array.isArray(body.addOns)?body.addOns.map(name=>({name})):[]);
  if(!Array.isArray(raw)||raw.length>10||body.addOns!==undefined&&!Array.isArray(body.addOns))fail(400,'Invalid add-on selections.');
  const seen=new Set();const items=[];
  for(const item of raw){
   if(!item||typeof item!=='object'||Array.isArray(item))fail(400,'Invalid add-on item.');
   const name=text(item.name,'Add-on',1,120);if(seen.has(name))fail(400,'Select each add-on once.');seen.add(name);
   if(!['Ball colors','Balloon arch','Backdrop & signage'].includes(name))fail(400,'This add-on is not offered for new bookings.');
   const row=await db.prepare('SELECT * FROM add_ons WHERE name=? AND is_active=1').get(name);if(!row)fail(400,'This add-on is not active.');
   const data={id:row.id,name,quantity:1,unit_price_cents:0};
   if(name==='Ball colors'){
    if(!includesBalls)fail(400,'Ball colors are included only with rentals containing a ball pit/balls.');
    if(item.quantity!==undefined&&Number(item.quantity)!==1)fail(400,'Ball-color selection has no quantity.');
    const color=text(item.color,'Ball color',1,80);if(!colors.includes(color))fail(400,'Choose a listed ball color.');
    data.color=color;data.optionName=color;data.optionId=null;
   }else if(name==='Balloon arch'){
    data.unit_price_cents=pricing.extras[name];data.quantity=integer(item.quantity??1,'Number of arches',1,20);
    if(!Array.isArray(item.colors)||item.colors.length<1||item.colors.length>3||new Set(item.colors).size!==item.colors.length||item.colors.some(c=>!colors.includes(c)))fail(400,'Choose one to three different arch colors.');
    data.colors=[...item.colors];
   }else{
    data.unit_price_cents=pricing.extras[name];
    if(item.quantity!==undefined&&Number(item.quantity)!==1)fail(400,'Select one backdrop.');
    if(!events.includes(item.eventType))fail(400,'Choose a backdrop event type.');
    data.eventType=item.eventType;data.otherEvent=item.eventType==='Other'?text(item.otherEvent,'Other event',2,100):'';
   }
   items.push(data);
  }
  if(body.addOns!==undefined&&[...new Set(body.addOns)].sort().join('|')!==items.map(i=>i.name).sort().join('|'))fail(400,'Add-on selections do not match.');
  return {pkg,model,variant,modelId:model?model.id:null,variantId,items,city,extraHours,notes,includesBalls,extraHourCents:pricing.extraHourCents};
 }
 function quote(s){
  const {extraHourCents}=s;
  if(s.pkg.base_price_cents===null||s.pkg.rental_hours===null)fail(409,'This rental price/duration is not configured. Contact the team.');
  const addons=s.items.reduce((sum,i)=>sum+i.quantity*i.unit_price_cents,0);
  const subtotal=s.pkg.base_price_cents+addons+s.extraHours*extraHourCents+s.city.delivery_cents;
  if(!Number.isSafeInteger(subtotal)||subtotal<=0||subtotal>100000000)fail(400,'Unsupported total amount.');
  const pending=s.notes.length>0;
  return {currency:'PHP',package_id:s.pkg.id,package_name:s.pkg.name,model_id:s.modelId,model_name:s.model?.name||s.pkg.name,
   image_url:s.model?.image_url||'',variant:s.variant?publicLabel(s.variant.name):null,base_price_cents:s.pkg.base_price_cents,
   included_hours:s.pkg.rental_hours,rental_hours:s.pkg.rental_hours+s.extraHours,extra_hours:s.extraHours,
   extra_hour_cents:extraHourCents,extra_hours_cents:s.extraHours*extraHourCents,
   city_id:s.city.id,city_name:s.city.name,delivery_cents:s.city.delivery_cents,add_ons:s.items,inclusions:JSON.parse(s.pkg.inclusions||'[]'),
   subtotal_cents:subtotal,total_cents:pending?null:subtotal,deposit_cents:pending?null:Math.ceil(subtotal/2),
   pricing_state:pending?'pending_quote':'final',source:pending?'catalog_pending':'catalog',is_demo:!!s.model?.is_demo,
   delivery_note:'Delivery is included in this breakdown. Fees use the configured NCR delivery zones.',
   message:pending?'Final total pending admin quotation. Your three-hour hold starts when submitted.':'Final total, including selected extras and delivery.'};
 }
 return {select,quote};
}
module.exports={publicLabel,cities,events,colors,excluded,extraHourCents,domain};
