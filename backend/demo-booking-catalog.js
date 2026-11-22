'use strict';
// Local demo only. Never rewrites an existing item or an operator's price.
const fixtures=[
 ['Classic White Castle','dry',650000,10,true,'classic-white-castle-balloon-garland.jpg',['White','Cream']],
 ['Boho Pastel Playground','dry',550000,12,true,'child-playing-cream-bounce-house.jpg',['Pastel','Neutral']],
 ['Rainbow Racer Slide','splash',750000,12,false,'rainbow-racer-slide-colorful.jpg',['Joyful colors','Blue / yellow']],
 ['Carnival Pop Castle','dry',450000,12,false,'carnival-pop-castle-ball-pit.jpg',['Carnival colors','Red / blue']],
 ['Pastel Ball Pit','ball-pit',350000,8,true,'kids-in-ball-pit-pastel.jpg',['White','Cream']],
];
async function seedDemo(db){
 await db.transaction(async()=>{
  for(const [name,slug,price,capacity,balls,image,variants]of fixtures){
   if(await db.prepare('SELECT 1 FROM rental_models WHERE name=?').get(name))continue;
   const zone=await db.prepare('SELECT id FROM rental_zones WHERE slug=?').get(slug);
   const packageName=name+' — Demo rental';
   await db.prepare('INSERT OR IGNORE INTO packages(name,description,base_price,base_price_cents,rental_hours,inclusions) VALUES (?,?,?,?,?,?)').run(packageName,'Synthetic demonstration offer; not an official company rate.',price/100,price,4,JSON.stringify(['4 rental hours','Standard setup and pickup','Ball-color choice included when applicable']));
   const pkg=await db.prepare('SELECT id FROM packages WHERE name=?').get(packageName);
   const inserted=await db.prepare('INSERT INTO rental_models(zone_id,name,description,capacity,image_url,booking_package_id,includes_balls,is_demo) VALUES (?,?,?,?,?,?,?,1)').run(zone.id,name,'Synthetic demo listing. Photo is illustrative; confirm real equipment specifications before live use.',capacity,'/assets/photos/'+image,pkg.id,balls?1:0);
   await db.prepare('INSERT INTO package_models(package_id,model_id) VALUES (?,?)').run(pkg.id,inserted.lastInsertRowid);
   for(const variant of variants)await db.prepare('INSERT INTO model_variants(model_id,name) VALUES (?,?)').run(inserted.lastInsertRowid,variant);
  }
 })();
}
module.exports={seedDemo,fixtures};
