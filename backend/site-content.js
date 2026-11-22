'use strict';

const fs = require('node:fs');
const path = require('node:path');
const legacy = require('./legacy-articles.json');

async function migrateContent(db, {seed=true}={}) {
  await db.transaction(async () => {
    await db.prepare(`CREATE TABLE IF NOT EXISTS blog_articles (
      slug TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL,
      category TEXT NOT NULL, date_label TEXT NOT NULL, image TEXT NOT NULL,
      image_alt TEXT NOT NULL, blocks TEXT NOT NULL, state TEXT NOT NULL
      CHECK (state IN ('draft','published','archived')),
      position INTEGER NOT NULL, provenance TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1
    )`).run();
    await db.prepare('CREATE TABLE IF NOT EXISTS business_configuration (setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL)').run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS review_editorial (
      review_id BIGINT PRIMARY KEY REFERENCES reviews(id), correction TEXT NOT NULL,
      featured INTEGER NOT NULL, archived INTEGER NOT NULL
    )`).run();
    if (db.driver !== 'sqlite') {
      await db.prepare('ALTER TABLE blog_articles ENABLE ROW LEVEL SECURITY').run();
      await db.prepare('ALTER TABLE business_configuration ENABLE ROW LEVEL SECURITY').run();
      await db.prepare('ALTER TABLE review_editorial ENABLE ROW LEVEL SECURITY').run();
    }
    if(!seed)return;
    const {cities,extraHourCents}=require('./booking-rules');
    await db.prepare('INSERT OR IGNORE INTO business_configuration(setting_key,setting_value) VALUES (?,?)')
      .run('pricing',JSON.stringify({cities,extraHourCents,extras:{'Ball colors':0,'Balloon arch':40000,'Backdrop & signage':80000}}));
    for (const item of legacy) {
      await db.prepare(`INSERT OR IGNORE INTO blog_articles
        (slug,title,summary,category,date_label,image,image_alt,blocks,state,position,provenance)
        VALUES (?,?,?,?,?,?,?,?,'published',?,'legacy-customer-site')`)
        .run(item.slug,item.title,item.summary,item.category,item.date_label,item.image,item.image_alt,JSON.stringify(item.blocks),item.position);
    }
  })();
}

async function setting(db, key) {
  const record = await db.prepare('SELECT setting_value FROM business_configuration WHERE setting_key=?').get(key);
  return record ? JSON.parse(record.setting_value) : null;
}

async function storeSetting(db, key, value) {
  await db.prepare(`INSERT INTO business_configuration(setting_key,setting_value) VALUES (?,?)
    ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value`).run(key,JSON.stringify(value));
}

function registerContent({app,db,audit,asyncRoute,fail,text,optional,integer}) {
  const listFields = 'slug,title,summary,category,date_label,image,image_alt,provenance';
  const views = 'SELECT ' + listFields + ' FROM blog_articles';
  const publicView = row => ({...row,url:row.provenance==='legacy-customer-site' ? row.slug+'.html' : 'article.html?slug='+encodeURIComponent(row.slug)});
  const full = row => ({...publicView(row),blocks:JSON.parse(row.blocks)});
  const slugOf = value => {
    const slug = text(value,'Article slug',1,120);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail(400,'Use lowercase words separated by hyphens for the article slug.');
    return slug;
  };
  app.get('/api/articles',asyncRoute(async (req,res) => {
    res.json({articles:(await db.prepare(views+" WHERE state='published' ORDER BY position,slug").all()).map(publicView)});
  }));
  app.get('/api/articles/:slug',asyncRoute(async (req,res) => {
    const row = await db.prepare("SELECT * FROM blog_articles WHERE slug=? AND state='published'").get(slugOf(req.params.slug));
    if (!row) fail(404,'This article is unavailable.');
    res.json({article:full(row)});
  }));
  app.get('/api/operator/articles',asyncRoute(async (req,res) => {
    res.json({articles:(await db.prepare('SELECT * FROM blog_articles ORDER BY position,slug').all()).map(full)});
  }));
  app.put('/api/operator/articles/:slug',asyncRoute(async (req,res) => {
    const slug = slugOf(req.params.slug);
    const title = text(req.body.title,'Title',1,200);
    const summary = optional(req.body.summary,'Summary',500);
    const category = optional(req.body.category,'Category',100);
    const dateLabel = optional(req.body.dateLabel,'Publication date label',120);
    const image = optional(req.body.image,'Image path',250);
    const alt = optional(req.body.imageAlt,'Image description',180);
    if (image && (!/^(?:\.\.\/|\/)assets\/[\w-]+(?:\/[\w-]+)*\.(?:png|jpe?g|webp)$/i.test(image) ||
      !fs.existsSync(path.join(__dirname,'..',image.replace(/^(?:\.\.\/|\/)/,''))))) {
      fail(400,'Choose an existing image under /assets.');
    }
    if (!['draft','published','archived'].includes(req.body.state)) fail(400,'Invalid article state.');
    await db.transaction(async () => {
      const previous = await db.prepare('SELECT * FROM blog_articles WHERE slug=?').get(slug);
      const revision = integer(req.body.revision ?? 0,'Article version',0,1000000);
      if ((previous?.revision || 0)!==revision) fail(409,'This article changed. Refresh before saving.');
      const blocks = req.body.body === undefined && previous ? previous.blocks :
        JSON.stringify(text(req.body.body,'Article body',1,20000).split(/\n\s*\n/).map(paragraph=>({tag:'p',children:[paragraph]})));
      if (previous) {
        const result = await db.prepare('UPDATE blog_articles SET title=?,summary=?,category=?,date_label=?,image=?,image_alt=?,blocks=?,state=?,revision=revision+1 WHERE slug=? AND revision=?')
          .run(title,summary,category,dateLabel,image,alt,blocks,req.body.state,slug,revision);
        if (!result.changes) fail(409,'This article changed. Refresh before saving.');
      } else {
        await db.prepare(`INSERT INTO blog_articles (slug,title,summary,category,date_label,image,image_alt,blocks,state,position,provenance)
          VALUES (?,?,?,?,?,?,?,?,?,-1,'staff')`).run(slug,title,summary,category,dateLabel,image,alt,blocks,req.body.state);
      }
      await audit(req.actor,'article.saved','article',null,{slug,before:previous?.state,after:req.body.state});
    })();
    res.json({success:true});
  }));
  app.get('/api/business-settings',asyncRoute(async (req,res) => {
    const record=await setting(db,'public');
    if(!record)return res.json({settings:null});
    const {note,bank,cash,gcash}=record.payment;
    res.json({settings:{contact:record.contact,payment:{...(gcash===undefined?{}:{gcash}),note,bank:bank.businessApproved?bank:null,cash:cash.businessApproved?cash:null}}});
  }));
  app.get('/api/operator/business-settings',asyncRoute(async (req,res) => res.json({settings:await setting(db,'public')})));
  app.put('/api/operator/reviews/:id/editorial',asyncRoute(async (req,res) => {
    const id=integer(req.params.id,'Review ID',1,Number.MAX_SAFE_INTEGER);
    if(typeof req.body.featured!=='boolean'||typeof req.body.archived!=='boolean')fail(400,'Specify featured and archive status.');
    const correction=optional(req.body.correction,'Public editorial correction',3000);
    const after={correction,featured:Number(req.body.featured),archived:Number(req.body.archived)};
    await db.transaction(async()=>{
      const review=await db.prepare('SELECT can_feature,moderation_status FROM reviews WHERE id=?').get(id);
      if(!review)fail(404,'Review not found.');
      if(after.featured&&(!review.can_feature||review.moderation_status!=='approved'))fail(409,'Public featuring requires consent and approval.');
      const before=await db.prepare('SELECT * FROM review_editorial WHERE review_id=?').get(id);
      await db.prepare(`INSERT INTO review_editorial(review_id,correction,featured,archived) VALUES (?,?,?,?)
        ON CONFLICT(review_id) DO UPDATE SET correction=excluded.correction,featured=excluded.featured,archived=excluded.archived`).run(id,correction,after.featured,after.archived);
      await audit(req.actor,'review.editorial','review',id,{before:before||null,after});
    })();
    res.json({success:true});
  }));
  app.get('/api/operator/pricing-policy',asyncRoute(async (req,res) => res.json(await setting(db,'pricing'))));
  app.put('/api/operator/pricing-policy',asyncRoute(async (req,res) => {
    const amount=(value,label)=>integer(value,label,0,10000000);
    await db.transaction(async()=>{
      const before=await setting(db,'pricing');
      const after={
        cities:before.cities.map(city=>({...city,delivery_cents:amount(req.body.delivery?.[city.id],city.name)})),
        extraHourCents:amount(req.body.extraHourCents,'Additional hour cents'),
        extras:{'Ball colors':0,'Balloon arch':amount(req.body.archCents,'Arch cents'),'Backdrop & signage':amount(req.body.backdropCents,'Backdrop cents')}
      };
      await storeSetting(db,'pricing',after);
      await audit(req.actor,'pricing.policy_updated','settings','pricing',{before,after});
    })();
    res.json({success:true});
  }));
  app.put('/api/operator/business-settings',asyncRoute(async (req,res) => {
    const read = (field,limit=160) => optional(req.body[field],field,limit);
    const contact = {name:read('name'),email:read('email'),phone:read('phone'),area:read('area'),hours:read('hours')};
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) fail(400,'Enter a valid contact email.');
    if (contact.phone && !/^\+?[\d ()-]{7,30}$/.test(contact.phone)) fail(400,'Enter a valid contact number.');
    const payment = {note:read('paymentNote',1000),bank:{
      businessApproved:req.body.bankApproved===true,bankName:read('bankName'),
      accountName:read('bankAccountName'),accountNumber:read('bankAccountNumber',60)
    },cash:{businessApproved:req.body.cashApproved===true,instructions:read('cashInstructions',1000)}};
    if (payment.bank.businessApproved && Object.values(payment.bank).some(value=>value==='')) fail(400,'Provide complete approved bank details.');
    if (payment.cash.businessApproved && !payment.cash.instructions) fail(400,'Provide approved cash instructions.');
    await db.transaction(async () => {
      const before=await setting(db,'public');
      const gcashMode=req.body.gcashMode??'keep';
      if(!['keep','disabled','enabled'].includes(gcashMode))fail(400,'Invalid GCash visibility.');
      if(gcashMode==='disabled')payment.gcash=null;
      else if(gcashMode==='enabled'){
        const name=read('gcashName');
        const number=read('gcashNumber',30);
        if(!name||!/^09\d{9}$/.test(number))fail(400,'Enter the receiving name and an 11-digit GCash number.');
        payment.gcash={name,number};
      }else if(before?.payment?.gcash!==undefined)payment.gcash=before.payment.gcash;
      await storeSetting(db,'public',{contact,payment});
      await audit(req.actor,'business.settings_updated','settings',null,{before:before?.contact,after:contact,bankApproved:payment.bank.businessApproved,cashApproved:payment.cash.businessApproved,gcashMode});
    })();
    res.json({success:true});
  }));
}

module.exports = {migrateContent,registerContent,setting,storeSetting};

