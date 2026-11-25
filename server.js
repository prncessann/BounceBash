'use strict';

async function start() {
  'use strict';

  const config = require('./backend/config');
  const express = require('express');
  const path = require('node:path');
  const crypto = require('node:crypto');
  const bcrypt = require('bcryptjs');
  const cookieParser = require('cookie-parser');
  const {
    db,
    audit
  } = require('./backend/database');
  await db.ready;
  const content = require("./backend/site-content");
  await content.migrateContent(db);
  if(config.demoCatalog)await require('./backend/demo-booking-catalog').seedDemo(db);
  const rules=require('./backend/booking-rules');
  const {
    enqueue,
    deliver
  } = require('./backend/notifications');
  const staffNotices=require('./backend/staff-notices');
  const noticeQueue=staffNotices.createNoticeQueue({db,enqueue,publicUrl:config.publicUrl,today});
  async function deliverScheduledNotices(){
    await noticeQueue.schedule();
    await deliver();
  }
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  const now = () => new Date().toISOString();
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  const token = () => crypto.randomBytes(32).toString('hex');
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    path: '/'
  };
  const asyncRoute = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);
  function fail(status, message) {
    const e = new Error(message);
    e.status = status;
    throw e;
  }
  function text(value, label, min = 0, max = 200) {
    if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
      fail(400, `${label} must contain ${min}–${max} characters.`);
    }
    return value.trim();
  }
  function optional(value, label, max = 200) {
    return text(value === undefined || value === null ? '' : value, label, 0, max);
  }
  function email(value) {
    const val = text(value, 'Email', 3, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) fail(400, 'Enter a valid email address.');
    return val;
  }
  function credential(value, label = 'Password') {
    if (typeof value !== 'string' || value.length < 1 || value.length > 200) fail(400, `${label} is required.`);
    return value;
  }
  function password(value) {
    if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value, 'utf8') > 72) fail(400, 'Password must be at least 8 characters and at most 72 UTF-8 bytes.');
    return value;
  }
  function phone(value, required = true) {
    const val = optional(value, 'Contact number', 30);
    if (!val && required || val && !/^\+?\d[\d ()-]{5,28}\d$/.test(val)) fail(400, 'Enter a valid contact number.');
    const digits = val.replace(/\D/g, '');
    if (val && (digits.length < 7 || digits.length > 15)) fail(400, 'Contact number must have 7–15 digits.');
    return val;
  }
  function integer(value, label, min, max) {
    if (!['string', 'number'].includes(typeof value) || String(value).trim() === '') fail(400, `${label} must be a whole number.`);
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < min || n > max) fail(400, `${label} must be a whole number from ${min} to ${max}.`);
    return n;
  }
  function money(value, label = 'Amount') {
    if (!['string', 'number'].includes(typeof value) || !/^\d+(\.\d{1,2})?$/.test(String(value))) fail(400, `${label} must have at most two decimal places.`);
    const cents = Math.round(Number(value) * 100);
    if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100000000) fail(400, `${label} must be between PHP 0.01 and PHP 1,000,000.`);
    return cents;
  }
  function boolean(value, label) {
    if (value === true || value === 'true' || value === 'on') return true;
    if (value === false || value === 'false' || value === undefined) return false;
    fail(400, `${label} must be true or false.`);
  }
  function today() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }
  function date(value, future = false) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(400, 'Enter a valid event date.');
    const d = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value || value < '2000-01-01' || value > '2100-12-31') fail(400, 'Enter a valid date between 2000 and 2100.');
    if (future && value < today()) fail(400, 'Event date must be today or later (Philippine time).');
    return value;
  }
  function eventTime(value) {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail(400, 'Event time must be a valid 24-hour HH:mm time.');
    return value;
  }
  function eventDateTime(day, time) {
    date(day, true);
    eventTime(time);
    if (new Date(`${day}T${time}:00+08:00`).getTime() <= Date.now()) fail(400, 'Event date and time must be in the future (Philippine time).');
  }
  function requireFutureBooking(b) {
    if (new Date(`${b.event_date}T${b.event_time}:00+08:00`).getTime() <= Date.now()) fail(409, 'This event has already started; contact the team for assistance.');
  }
  const activeSQL = "status IN ('pending','confirmed','completed')";
  async function maintenance() {
    await db.transaction(async () => {
      const expired = await db.prepare("SELECT id,email,reference_code FROM bookings WHERE status='pending' AND expires_at IS NOT NULL AND expires_at <= ?").all(now());
      for (const b of expired) {
        await db.prepare("UPDATE bookings SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(b.id);
        await audit('system', 'booking.expired', 'booking', b.id);
        await enqueue(b.email, 'booking.expired', {
          reference: b.reference_code,
          message: 'The pending hold expired. Contact the team if a payment is awaiting verification.'
        });
      }
      await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now());
      await db.prepare('DELETE FROM account_tokens WHERE expires_at <= ?').run(now());
      await db.prepare('DELETE FROM rate_limits WHERE expires_at <= ?').run(Date.now());
      await db.prepare('DELETE FROM staff_sessions WHERE expires_at <= ?').run(now());
    })();
  }
  async function available(day, exclude = 0) {
    if (await db.prepare('SELECT 1 FROM date_blocks WHERE event_date=?').get(day)) return false;
    return !(await db.prepare(`SELECT 1 FROM bookings WHERE event_date=? AND ${activeSQL} AND id!=?`).get(day, exclude));
  }
  async function userFor(req) {
    const raw = req.cookies.session_token;
    if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) return null;
    return (await db.prepare('SELECT c.* FROM customers c JOIN sessions s ON c.id=s.customer_id WHERE s.token=? AND s.expires_at>?').get(hash(raw), now())) || null;
  }
  function publicUser(u) {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      city: u.city,
      address: u.address,
      email_verified: !!u.email_verified,
      created_at: u.created_at
    };
  }
  async function auth(req, res, next) {
    req.user = await userFor(req);
    if (!req.user) return next(Object.assign(new Error('Authentication required.'), {
      status: 401
    }));
    next();
  }
  async function staffFor(req) {
    const raw = req.cookies.staff_session;
    if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) return null;
    return (await db.prepare('SELECT u.* FROM staff_users u JOIN staff_sessions s ON u.id=s.staff_id WHERE s.token=? AND s.expires_at>?').get(hash(raw), now())) || null;
  }
  async function operator(req, res, next) {
    const raw = req.get('Authorization') || '';
    if (config.operatorKey && crypto.timingSafeEqual(Buffer.from(hash(raw)), Buffer.from(hash(`Bearer ${config.operatorKey}`)))) {
      req.actor = 'operator';
      return next();
    }
    const staff = await staffFor(req);
    if (staff) {
      req.actor = 'staff:' + staff.id;
      return next();
    }
    if (!config.operatorKey) return next(Object.assign(new Error('Operator access is disabled until OPERATOR_API_KEY is configured.'), { status: 503 }));
    return next(Object.assign(new Error('Operator authentication required.'), { status: 401 }));
  }
  async function session(res, id) {
    const raw = token();
    await db.prepare('INSERT INTO sessions(customer_id,token,expires_at) VALUES (?,?,?)').run(id, hash(raw), new Date(Date.now() + 7 * 86400000).toISOString());
    res.cookie('session_token', raw, {
      ...cookieOptions,
      maxAge: 7 * 86400000
    });
  }
  async function issueAccountToken(user, kind) {
    const raw = token();
    await db.prepare('DELETE FROM account_tokens WHERE customer_id=? AND kind=?').run(user.id, kind);
    await db.prepare('INSERT INTO account_tokens(customer_id,kind,token_hash,expires_at) VALUES (?,?,?,?)').run(user.id, kind, hash(raw), new Date(Date.now() + (kind === 'reset' ? 30 : 1440) * 60000).toISOString());
    const url = new URL('/Bouncebash_CS/account-help.html', config.publicUrl);
    url.hash = `${kind}=${raw}`;
    await enqueue(user.email, `account.${kind}`, {
      url: url.href,
      message: kind === 'reset' ? 'Reset your password within 30 minutes.' : 'Verify your email within 24 hours.'
    });
  }
  function rate(label,max,ms,accountScoped=false){
    return asyncRoute(async(req,res,next)=>{
      const account=accountScoped ? (req.user||await userFor(req)):null;
      const scope=account?`customer:${account.id}`:(req.ip||req.socket.remoteAddress||'unknown');
      const identity=hash(`${label}:${scope}`);const t=Date.now();
      const row=await db.prepare('INSERT INTO rate_limits(bucket,count,expires_at) VALUES (?,?,?) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<=? THEN 1 ELSE rate_limits.count+1 END, expires_at=CASE WHEN rate_limits.expires_at<=? THEN ? ELSE rate_limits.expires_at END RETURNING count,expires_at').get(identity,1,t+ms,t,t,t+ms);
      if(row.count>max){res.set('Retry-After',String(Math.max(1,Math.ceil((Number(row.expires_at)-t)/1000))));return res.status(429).json({error:'Too many requests. Please try again later.'});}
      next();
    });
  }
  const authRate = rate('authentication', config.authLimit, 15 * 60000);
  const publicRate = rate('public-submissions', config.publicLimit, 15 * 60000);
  const quoteRate=rate('quote-preview-v2',config.quoteLimit,60000);
  const bookingReadRate=rate('booking-read-v2',config.readLimit,60000,true);
  const bookingActionRate=rate('booking-action-v2',config.bookingActionLimit,15*60000,true);
  await db.prepare("CREATE TABLE IF NOT EXISTS staff_users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS staff_sessions (id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL)").run();
  const proofTypes = { 'image/png':'png','image/jpeg':'jpeg','image/webp':'webp' };
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'"
    });
    if (config.production) res.set('Strict-Transport-Security', 'max-age=31536000');
    const origin = req.get('Origin');
    const localOrigins = [`http://localhost:${config.port}`, `http://127.0.0.1:${config.port}`];
    if (origin && origin !== config.publicUrl.origin && (config.production || !localOrigins.includes(origin))) return res.status(403).json({
      error: 'Origin is not allowed.'
    });
    if (req.get('Sec-Fetch-Site') === 'cross-site' && !['GET', 'HEAD'].includes(req.method)) return res.status(403).json({
      error: 'Cross-site writes are not allowed.'
    });
    // Customer pages and API deliberately use a single origin: no credentialed cross-origin CORS.
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    if (req.path.startsWith('/api')) {
      res.set('Cache-Control', 'no-store');
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !(req.path === '/api/auth/logout' && !req.get('Content-Type') && !Number(req.get('Content-Length') || 0)) && !req.is('application/json')) return res.status(415).json({
        error: 'Use Content-Type: application/json.'
      });
    }
    next();
  });
  app.use(express.json({
    limit: '64kb',
    strict: false
  }));
  app.use(cookieParser());
  app.get('/api/cron/notifications', asyncRoute(async (req, res) => {
    const bearer = req.get('Authorization') || '';
    if (!config.cronSecret || !crypto.timingSafeEqual(Buffer.from(hash(bearer)), Buffer.from(hash(`Bearer ${config.cronSecret}`)))) {
      return res.status(401).json({error:'Scheduler authentication required.'});
    }
    if (!config.webhookUrl) fail(503, 'Notification delivery is unavailable.');
    await deliverScheduledNotices();
    res.json({success:true});
  }));
  app.use('/api', asyncRoute(async (req, res, next) => {
    if (req.body !== undefined && (req.body === null || Array.isArray(req.body) || typeof req.body !== 'object')) return res.status(400).json({
      error: 'Request body must be a JSON object.'
    });
    req.body ||= {};
    await maintenance();
    next();
  }));
  app.get('/health', asyncRoute(async (req, res) => {
    await db.prepare('SELECT 1').get();
    res.json({
      status: 'ok',
      time: now()
    });
  }));
  async function publicAddOns(){
    const pricing=await content.setting(db,'pricing');
    const rows=await db.prepare("SELECT id,name,description,unit_price_cents,max_quantity FROM add_ons WHERE is_active=1 AND name IN ('Ball colors','Balloon arch','Backdrop & signage') ORDER BY id").all();
    return rows.map(a=>({...a,unit_price_cents:pricing.extras[a.name]}));
  }
  app.get('/api/catalog', asyncRoute(async (req, res) => res.json({
    packages: await db.prepare('SELECT id,name,description,base_price,base_price_cents,rental_hours,inclusions FROM packages WHERE is_active=1 ORDER BY id').all(),
    addOns: await publicAddOns(),
    zones: await db.prepare('SELECT * FROM rental_zones ORDER BY id').all(),
    models: await db.prepare('SELECT * FROM rental_models WHERE is_active=1 ORDER BY id').all(),
    variants: (await db.prepare('SELECT * FROM model_variants WHERE is_active=1 ORDER BY id').all()).map(v=>({...v,name:rules.publicLabel(v.name)})),
    packageModels: await db.prepare('SELECT * FROM package_models').all(),
    options: await db.prepare('SELECT * FROM add_on_options WHERE is_active=1 ORDER BY id').all(),
    cities: (await content.setting(db,'pricing')).cities,colors:rules.colors,backdropEvents:rules.events,extra_hour_cents:(await content.setting(db,'pricing')).extraHourCents,hold_seconds:10800,
    pricing:'Server-calculated final total when notes are empty; notes require a final admin quotation.'
  })));
  app.get('/api/availability', asyncRoute(async (req, res) => {
    const day = date(req.query.date);
    const open = await available(day);
    res.json({
      date: day,
      available: open,
      status: open ? 'available' : 'booked',
      message: open ? 'This date is open for a booking request.' : 'This date has an active booking or pending hold.'
    });
  }));
  app.get('/api/availability/month', asyncRoute(async (req, res) => {
    const year = integer(req.query.year, 'Year', 2000, 2100);
    const month = integer(req.query.month, 'Month', 1, 12);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    const rows = await db.prepare(`SELECT event_date AS date, CASE WHEN SUM(CASE WHEN status='confirmed' THEN 1 ELSE 0 END)>0 THEN 'confirmed' ELSE MIN(status) END AS status FROM bookings WHERE event_date>=? AND event_date<? AND ${activeSQL} GROUP BY event_date ORDER BY event_date`).all(start, end);
    for(const row of rows)row.status='unavailable';
    const blocks = await db.prepare('SELECT event_date AS date FROM date_blocks WHERE event_date>=? AND event_date<?').all(start, end);
    for (const block of blocks) if (!rows.some(r => r.date === block.date)) rows.push({
      date: block.date,
      status: 'blocked'
    });
    rows.sort((a, b) => a.date.localeCompare(b.date));
    res.json({
      year,
      month,
      unavailableDates: rows
    });
  }));
  app.post('/api/auth/signup', authRate, asyncRoute(async (req, res) => {
    const name = text(req.body.name, 'Full name', 2, 120);
    const mail = email(req.body.email);
    const pass = password(req.body.password);
    if (await db.prepare('SELECT id FROM customers WHERE email=? COLLATE NOCASE').get(mail)) fail(409, 'An account already exists with that email address.');
    const passwordHash = await bcrypt.hash(pass, 10);
    const id = await db.transaction(async () => {
      const row = await db.prepare("INSERT INTO customers(name,email,password_hash,phone,city,address) VALUES (?,?,?,'','','')").run(name, mail, passwordHash);
      const user = await db.prepare('SELECT * FROM customers WHERE id=?').get(row.lastInsertRowid);
      await issueAccountToken(user, 'verify');
      await audit(`customer:${user.id}`, 'account.created', 'customer', user.id);
      return user.id;
    })();
    await session(res, id);
    res.status(201).json({
      success: true,
      message: 'Account created successfully. Verification instructions are queued for email delivery.',
      user: publicUser(await db.prepare('SELECT * FROM customers WHERE id=?').get(id))
    });
  }));
  // Same cost for missing and incorrect credentials to reduce account enumeration by timing.
  const dummyHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
  app.post('/api/auth/login', authRate, asyncRoute(async (req, res) => {
    const mail = email(req.body.email);
    const pass = credential(req.body.password);
    const user = await db.prepare('SELECT * FROM customers WHERE email=? COLLATE NOCASE').get(mail);
    const valid = await bcrypt.compare(pass, user ? user.password_hash : dummyHash);
    if (!user || !valid || (await db.prepare('SELECT password_hash FROM customers WHERE id=?').get(user.id)).password_hash !== user.password_hash) fail(401, 'Invalid email or password.');
    await session(res, user.id);
    res.json({
      success: true,
      message: 'Logged in successfully.',
      user: publicUser(user)
    });
  }));
  app.post('/api/auth/logout', asyncRoute(async (req, res) => {
    if (typeof req.cookies.session_token === 'string') await db.prepare('DELETE FROM sessions WHERE token=?').run(hash(req.cookies.session_token));
    res.clearCookie('session_token', cookieOptions);
    res.json({
      success: true,
      message: 'Logged out successfully.'
    });
  }));
  app.get('/api/auth/session', asyncRoute(async (req, res) => {
    const user = await userFor(req);
    res.json(user ? {
      authenticated: true,
      user: publicUser(user)
    } : {
      authenticated: false
    });
  }));
  app.get('/api/customers/me', asyncRoute(auth), (req, res) => res.json({
    user: publicUser(req.user)
  }));
  app.put('/api/customers/me', asyncRoute(auth), asyncRoute(async (req, res) => {
    const name = text(req.body.name, 'Full name', 2, 120);
    const mail = email(req.body.email);
    const contact = phone(req.body.phone, false);
    const city = optional(req.body.city, 'City', 100);
    const address = optional(req.body.address, 'Address', 1000);
    if (await db.prepare('SELECT id FROM customers WHERE email=? COLLATE NOCASE AND id!=?').get(mail, req.user.id)) fail(409, 'That email address is already in use.');
    // Prevent an unattended open session from silently transferring the account to another email.
    if (mail !== req.user.email) fail(400, 'Use the email-change form and confirm your password to change your email address.');
    await db.prepare('UPDATE customers SET name=?,phone=?,city=?,address=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(name, contact, city, address, req.user.id);
    await audit(`customer:${req.user.id}`, 'profile.updated', 'customer', req.user.id);
    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: publicUser(await db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id))
    });
  }));
  app.put('/api/customers/email', asyncRoute(auth), authRate, asyncRoute(async (req, res) => {
    const mail = email(req.body.email);
    const pass = credential(req.body.current, 'Current password');
    if (!(await bcrypt.compare(pass, req.user.password_hash))) fail(401, 'Current password is incorrect.');
    if (mail === req.user.email) fail(400, 'Enter a different email address.');
    if (await db.prepare('SELECT id FROM customers WHERE email=? COLLATE NOCASE').get(mail)) fail(409, 'That email address is already in use.');
    await db.transaction(async () => {
      if((await db.prepare('SELECT password_hash FROM customers WHERE id=?').get(req.user.id)).password_hash!==req.user.password_hash)fail(409,'Account credentials changed. Please sign in again.');
      await db.prepare('UPDATE customers SET email=?,email_verified=0,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(mail, req.user.id);
      await db.prepare('DELETE FROM account_tokens WHERE customer_id=?').run(req.user.id);
      await db.prepare('DELETE FROM sessions WHERE customer_id=?').run(req.user.id);
      await issueAccountToken({
        ...req.user,
        email: mail
      }, 'verify');
      await enqueue(req.user.email, 'account.email_changed', {
        message: 'Your account email was changed. Contact the team if this was not you.'
      });
      await audit(`customer:${req.user.id}`, 'account.email_changed', 'customer', req.user.id);
    })();
    await session(res, req.user.id);
    res.json({
      success: true,
      message: 'Email changed. Verification instructions are queued; other sessions were signed out.'
    });
  }));
  app.put('/api/customers/password', asyncRoute(auth), authRate, asyncRoute(async (req, res) => {
    const current = credential(req.body.current, 'Current password');
    const next = password(req.body.new);
    if (!(await bcrypt.compare(current, req.user.password_hash))) fail(401, 'Current password is incorrect.');
    const h = await bcrypt.hash(next, 10);
    // Recheck the old hash after asynchronous work so concurrent password changes cannot overwrite each other.
    await db.transaction(async () => {
      if (!(await db.prepare('UPDATE customers SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND password_hash=?').run(h, req.user.id, req.user.password_hash)).changes) fail(409, 'Password changed in another request. Please log in again.');
      await db.prepare('DELETE FROM sessions WHERE customer_id=?').run(req.user.id);
      await db.prepare('DELETE FROM account_tokens WHERE customer_id=?').run(req.user.id);
      await audit(`customer:${req.user.id}`, 'password.changed', 'customer', req.user.id);
    })();
    await session(res, req.user.id);
    res.json({
      success: true,
      message: 'Password updated successfully. Other sessions have been signed out.'
    });
  }));
  app.post('/api/auth/forgot-password', authRate, asyncRoute(async (req, res) => {
    const mail = email(req.body.email);
    const user = await db.prepare('SELECT * FROM customers WHERE email=? COLLATE NOCASE').get(mail);
    if (user) await issueAccountToken(user, 'reset');
    res.json({
      success: true,
      message: 'If this account exists, reset instructions are queued for email delivery.'
    });
  }));
  app.post('/api/auth/reset-password', authRate, asyncRoute(async (req, res) => {
    const raw = text(req.body.token, 'Reset token', 64, 64);
    const pass = password(req.body.password);
    const h = await bcrypt.hash(pass, 10);
    await db.transaction(async () => {
      const entry = await db.prepare("SELECT * FROM account_tokens WHERE token_hash=? AND kind='reset' AND expires_at>?").get(hash(raw), now());
      if (!entry) fail(400, 'Reset link is invalid or expired.');
      await db.prepare('UPDATE customers SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(h, entry.customer_id);
      await db.prepare('DELETE FROM sessions WHERE customer_id=?').run(entry.customer_id);
      await db.prepare('DELETE FROM account_tokens WHERE customer_id=?').run(entry.customer_id);
      await audit(`customer:${entry.customer_id}`, 'password.reset', 'customer', entry.customer_id);
    })();
    res.clearCookie('session_token', cookieOptions);
    res.json({
      success: true,
      message: 'Password reset successfully. Please log in.'
    });
  }));
  app.post('/api/auth/verification-request', asyncRoute(auth), authRate, asyncRoute(async (req, res) => {
    if (!req.user.email_verified) await issueAccountToken(req.user, 'verify');
    res.json({
      success: true,
      message: 'Verification instructions are queued if needed.'
    });
  }));
  app.post('/api/auth/verify-email', authRate, asyncRoute(async (req, res) => {
    const raw = text(req.body.token, 'Verification token', 64, 64);
    await db.transaction(async () => {
      const entry = await db.prepare("SELECT * FROM account_tokens WHERE token_hash=? AND kind='verify' AND expires_at>?").get(hash(raw), now());
      if (!entry) fail(400, 'Verification link is invalid or expired.');
      await db.prepare('UPDATE customers SET email_verified=1 WHERE id=?').run(entry.customer_id);
      await db.prepare('DELETE FROM account_tokens WHERE id=?').run(entry.id);
      await audit(`customer:${entry.customer_id}`, 'email.verified', 'customer', entry.customer_id);
    })();
    res.json({
      success: true,
      message: 'Email verified successfully.'
    });
  }));
  async function getBooking(ref) {
    const booking = await db.prepare('SELECT * FROM bookings WHERE reference_code=?').get(text(ref, 'Booking reference', 3, 60));
    if (!booking) fail(404, 'Booking not found.');
    return booking;
  }
  async function authorizedBooking(req) {
    const user=await userFor(req);if(!user)fail(401,'Sign in to access your booking.');
    const booking=await getBooking(req.params.reference);
    if(booking.customer_id!==user.id)fail(404,'Booking not found.');return booking;
  }
  async function assertBookingState(b){
    const current=await db.prepare('SELECT * FROM bookings WHERE id=?').get(b.id);
    if(!current || ['status','event_date','event_time','total_cents','deposit_cents','expires_at','pricing_state'].some(key=>current[key]!==b[key]))fail(409,'This booking changed in another request. Refresh and retry.');
  }
  async function paymentsFor(id) {
    return await db.prepare('SELECT p.id,p.amount_cents,p.reference,p.method,p.status,p.review_note,p.created_at,pr.id AS proof_id FROM payments p LEFT JOIN payment_proofs pr ON pr.payment_id=p.id WHERE p.booking_id=? ORDER BY p.id DESC').all(id);
  }
  async function bookingView(b) {
    const payments = await paymentsFor(b.id);
    const verified = payments.filter(p => p.status === 'verified').reduce((s, p) => s + p.amount_cents, 0);
    return {
      id: b.id,
      reference: b.reference_code,
      name: b.name,
      contact_number: b.contact_number,
      email: b.email,
      event_date: b.event_date,
      event_time: b.event_time,
      venue: b.venue,
      package_name: b.package_name,
      children_count: b.children_count,
      city_id:b.city_id,extra_hours:b.extra_hours,delivery_fee_cents:b.delivery_fee_cents,subtotal_cents:b.subtotal_cents,
      pricing_state:b.pricing_state==='legacy' ? (b.total_cents===null?'pending_quote':'final'):b.pricing_state,
      flow_version:b.flow_version,server_time:now(),
      payment_requires_attention:['expired','cancelled'].includes(b.status)&&payments.some(p=>['pending','verified'].includes(p.status)),
      selected_style: b.selected_style,
      add_ons: JSON.parse(b.add_ons || '[]'),
      notes: b.notes,
      status: b.status,
      expires_at: b.expires_at,
      created_at: b.created_at,
      total_cents: b.total_cents,
      deposit_cents: b.deposit_cents,
      paid_cents: verified,
      balance_cents: b.total_cents === null ? null : Math.max(0, b.total_cents - verified),
      payment_status: verified === 0 ? 'Not Paid' : b.total_cents !== null && verified >= b.total_cents ? 'Fully Paid' : b.deposit_cents !== null && verified >= b.deposit_cents ? 'Downpayment Paid' : 'Partial Deposit',
      cancellation_reason: b.cancellation_reason,
      model_id: b.model_id,
      variant_id: b.variant_id,
      selection: JSON.parse(b.selection_json || '{}'),
      quote: b.quote_json ? JSON.parse(b.quote_json) : null,
      payments,
      refund_note: ['cancelled', 'expired'].includes(b.status) && verified > 0 ? 'Verified payments remain recorded. Contact the team for refund handling; cancellation does not automatically refund funds.' : null
    };
  }
  async function notifyBooking(b, kind, message) {
    await enqueue(b.email, kind, {
      reference: b.reference_code,
      message
    });
  }
  app.get('/api/bookings/mine', asyncRoute(auth), asyncRoute(async (req, res) => res.json({
    bookings: await Promise.all((await db.prepare('SELECT * FROM bookings WHERE customer_id=? ORDER BY id DESC LIMIT 200').all(req.user.id)).map(bookingView))
  })));
  async function createBooking(body, user, staffActor) {
    if(!user&&!staffActor)fail(401,'Sign in before submitting a booking.');
    const name = text(body.name, 'Customer name', 2, 120);
    const contact = phone(body.contact);
    const day = date(body.eventDate || body.event_date, true);
    const time = eventTime(body.eventTime || body.event_time);
    eventDateTime(day, time);
    const venue = text(body.venue, 'Venue', 2, 1000);
    let packageName;
    const children = null;
    const style = optional(body.selectedStyle ?? body.selected_style, 'Style', 120);
    const styles = ['Classic White Castle', 'Boho Pastel Playground', 'Rainbow Racer Slide', 'Carnival Pop Castle'];
    if (style && !styles.includes(style)) fail(400, 'Selected style is not valid.');
    const notes = optional(body.notes, 'Notes', 3000);
    if (!boolean(body.reservationFeeAccepted, 'Reservation acknowledgement')) fail(400, 'Confirm the 50% reservation fee requirement.');
    if (body.addOns !== undefined && (!Array.isArray(body.addOns) || body.addOns.length > 20)) fail(400, 'Add-ons must be an array of at most 20 names.');
    const mail = body.email ? email(body.email) : user ? user.email : '';
    const reference = `BB-${today().replace(/-/g, '')}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const expires = new Date(Date.now() + config.pendingHours * 3600000).toISOString();
    const id = await db.transaction(async () => {
      const selection = await catalogSelection(body);
      packageName=selection.pkg.name;
      const quote=quoteForSelection(selection);
      if(body.reviewToken!==undefined && body.reviewToken!==hash(JSON.stringify(quote)))fail(409,'Pricing changed. Review the updated quote before submitting.');
      if (!(await available(day))) fail(409, 'This event date is already reserved. Please pick another date.');
      const selectedAddOns = selection.items.map(item => item.name);
      const result = await db.prepare(`INSERT INTO bookings(customer_id,reference_code,name,contact_number,event_date,event_time,venue,package_name,children_count,selected_style,add_ons,notes,reservation_fee_accepted,status,email,access_token_hash,expires_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,'pending',?,?,?)`).run(user ? user.id : null, reference, name, contact, day, time, venue, packageName, children, style || null, JSON.stringify(selectedAddOns), notes, mail, null, expires);
      for (const item of selection.items) await db.prepare('INSERT INTO booking_add_ons(booking_id,add_on_id) VALUES (?,?)').run(result.lastInsertRowid, item.id);
      await db.prepare('UPDATE bookings SET model_id=?,variant_id=?,selection_json=?,quote_json=?,total_cents=?,deposit_cents=? WHERE id=?').run(selection.modelId, selection.variantId, JSON.stringify(selection.items), quote ? JSON.stringify(quote) : null, quote ? quote.total_cents : null, quote ? quote.deposit_cents : null, result.lastInsertRowid);
      await db.prepare('UPDATE bookings SET city_id=?,extra_hours=?,delivery_fee_cents=?,subtotal_cents=?,pricing_state=?,flow_version=2 WHERE id=?').run(selection.city.id,selection.extraHours,selection.city.delivery_cents,quote.subtotal_cents,quote.pricing_state,result.lastInsertRowid);
      await audit(staffActor || (user ? `customer:${user.id}` : 'guest'), 'booking.created', 'booking', result.lastInsertRowid, {
        reference,
        date: day
      });
      await noticeQueue.notify('newBooking','/Bouncebash_Admin/bookings.html?reference='+encodeURIComponent(reference),'A new booking is ready for review.');
      if (mail) {
        const manage = new URL('/Bouncebash_CS/manage-booking.html', config.publicUrl);
        manage.searchParams.set('reference',reference);
        await enqueue(mail, 'booking.created', {
          reference,
          url: manage.href,
          expires_at: expires,
          message: 'Your pending booking request has been received. A quote and verified deposit are required for confirmation.'
        });
      }
      return result.lastInsertRowid;
    }).immediate();
    return {
      success: true,
      message: 'Booking submitted and added to your profile. Your date is unavailable to others during the three-hour hold.',
      booking: {
        id,
        reference,
        expires_at: expires,
        status: 'pending',server_time:now()
      }
    };
  }
  app.post('/api/bookings', asyncRoute(auth), bookingActionRate, asyncRoute(async (req, res) => res.status(201).json(await createBooking(req.body,req.user))));
  app.get('/api/bookings/:reference', bookingReadRate, asyncRoute(async (req, res) => res.json({
    booking: await bookingView(await authorizedBooking(req))
  })));
  app.post('/api/bookings/:reference/cancel', asyncRoute(auth), bookingActionRate, asyncRoute(async (req, res) => {
    const b = await authorizedBooking(req);
    const reason = text(req.body.reason || 'Cancelled by customer', 'Reason', 2, 1000);
    if (!['pending', 'confirmed'].includes(b.status)) fail(409, 'Only pending or confirmed bookings can be cancelled.');
    requireFutureBooking(b);
    await db.transaction(async () => {
      await assertBookingState(b);
      await db.prepare("UPDATE bookings SET status='cancelled',expires_at=NULL,cancellation_reason=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(reason, b.id);
      await audit(b.customer_id ? `customer:${b.customer_id}` : 'guest', 'booking.cancelled', 'booking', b.id, {
        reason
      });
      await notifyBooking(b, 'booking.cancelled', 'Your booking was cancelled. Any refund requires separate handling by the team.');
    })();
    res.json({
      success: true,
      message: 'Booking cancelled. Contact the team about any recorded payments or refund.',
      booking: await bookingView(await getBooking(b.reference_code))
    });
  }));
  const rescheduleBooking = asyncRoute(async (req, res) => {
    const b = req.actor ? await getBooking(req.params.reference) : await authorizedBooking(req);
    if (!['pending', 'confirmed'].includes(b.status)) fail(409, 'Only active bookings can be rescheduled.');
    requireFutureBooking(b);
    const day = date(req.body.eventDate, true);
    const time = eventTime(req.body.eventTime);
    eventDateTime(day, time);
    if (day === b.event_date && time === b.event_time) fail(400, 'Choose a different date or time.');
    await db.transaction(async () => {
      await assertBookingState(b);
      if (!(await available(day, b.id))) fail(409, 'The requested date is already reserved.');
      await db.prepare("UPDATE bookings SET event_date=?,event_time=?,status='pending',expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(day, time, new Date(Date.now() + config.pendingHours * 3600000).toISOString(), b.id);
      await audit(req.actor || (b.customer_id ? `customer:${b.customer_id}` : 'guest'), 'booking.rescheduled', 'booking', b.id, {
        from: b.event_date,
        to: day
      });
      await notifyBooking(b, 'booking.rescheduled', `Reschedule requested for ${day} ${time}. Operator confirmation is required again; existing payments remain recorded.`);
    }).immediate();
    res.json({
      success: true,
      message: 'Reschedule requested. The team must confirm the new schedule.',
      booking: await bookingView(await getBooking(b.reference_code))
    });
  });
  app.post('/api/bookings/:reference/reschedule',asyncRoute(auth),bookingActionRate,rescheduleBooking);
  const recordPaymentReference = asyncRoute(async (req, res) => {
    const b = req.actor ? await getBooking(req.params.reference) : await authorizedBooking(req);
    if (!['pending', 'confirmed'].includes(b.status)) fail(409, 'Payments cannot be submitted for an inactive booking.');
    if (!req.actor) requireFutureBooking(b);
    if (b.total_cents === null) fail(409, 'Wait for the team to provide a quote before submitting a payment reference.');
    if(b.pricing_state==='pending_quote')fail(409,'Wait for the final admin quotation before paying.');
    const fields=req.body;
    const cents = money(fields.amount);
    const reference = text(fields.reference, 'Transaction reference', 4, 120);
    if (!/^[A-Za-z0-9][A-Za-z0-9 _./-]*$/.test(reference)) fail(400, 'Transaction reference contains invalid characters.');
    const method = text(fields.method, 'Payment method', 2, 40);
    if (!['GCash', 'Bank transfer', 'Cash'].includes(method)) fail(400, 'Select GCash, Bank transfer, or Cash.');
    const id = await db.transaction(async () => {
      await assertBookingState(b);
      const outstanding = (await db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS total FROM payments WHERE booking_id=? AND status IN ('pending','verified')").get(b.id)).total;
      if (outstanding + cents > b.total_cents) fail(409, 'This amount exceeds the remaining unreported balance, including pending payments.');
      const row = await db.prepare('INSERT INTO payments(booking_id,amount_cents,reference,method) VALUES (?,?,?,?)').run(b.id, cents, reference, method);

      await audit(req.actor || `customer:${b.customer_id}`, 'payment.submitted', 'payment', row.lastInsertRowid, {
        booking_id: b.id,
        amount_cents: cents
      });
      await notifyBooking(b, 'payment.submitted', 'Payment reference received and awaiting manual verification. Funds have not been verified by this website.');
      await noticeQueue.notify('paymentReceived','/Bouncebash_Admin/bookings.html?reference='+encodeURIComponent(b.reference_code),'A payment reference is awaiting verification.');
      return row.lastInsertRowid;
    }).immediate();
    res.status(201).json({
      success: true,
      paymentId: id,
      message: 'Payment reference submitted. Your payment is awaiting verification.'
    });
  });
  app.post('/api/bookings/:reference/payments', asyncRoute(auth), bookingActionRate, recordPaymentReference);
  function sendProof(res, proof) {
    if (!proof) fail(404, 'Payment proof not found.');
    const extension = proofTypes[proof.media_type];
    res.set('Content-Disposition', 'attachment; filename="payment-proof.' + extension + '"');
    res.type(proof.media_type);
    const bytes = Buffer.from(proof.image);
    if (bytes.length <= 4 * 1024 * 1024) return res.send(bytes);
    // Stream large downloads through the Vercel response size limit.
    const { Readable } = require('node:stream');
    function* chunks() {
      for (let offset = 0; offset < bytes.length; offset += 256 * 1024) {
        yield bytes.subarray(offset, offset + 256 * 1024);
      }
    }
    Readable.from(chunks()).pipe(res);
  }
  app.get('/api/bookings/:reference/payment-proofs/:proofId', asyncRoute(async (req, res) => {
    const b = await authorizedBooking(req);
    sendProof(res, await db.prepare('SELECT pr.media_type,pr.image FROM payment_proofs pr JOIN payments p ON p.id=pr.payment_id WHERE pr.id=? AND p.booking_id=?').get(req.params.proofId, b.id));
  }));
  app.get('/api/reviews', asyncRoute(async (req, res) => {
    const limit = integer(req.query.limit ?? 6, 'Limit', 1, 50);
    const offset = integer(req.query.offset ?? 0, 'Offset', 0, 1000000);
    const filter = ["can_feature=1", "moderation_status='approved'", "COALESCE(e.archived,0)=0"];
    if (req.query.featured === 'true') filter.push('COALESCE(e.featured,1)=1');
    const params = [];
    if (req.query.rating !== undefined) {
      filter.push('rating=?');
      params.push(integer(req.query.rating, 'Rating', 1, 5));
    }
    if (req.query.eventType) {
      filter.push('event_type=?');
      params.push(text(req.query.eventType, 'Event type', 1, 100));
    }
    const where = filter.join(' AND ');
    const source = "reviews LEFT JOIN review_editorial e ON e.review_id=reviews.id";
    const reviews = await db.prepare(`SELECT id,name,event_type,package_name,rating,message,created_at,e.correction FROM ${source} WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    const total = (await db.prepare(`SELECT COUNT(*) AS n FROM ${source} WHERE ${where}`).get(...params)).n;
    const dist = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0
    };
    let count = 0;
    let sum = 0;
    for (const row of await db.prepare("SELECT rating,COUNT(*) AS n FROM reviews LEFT JOIN review_editorial e ON e.review_id=reviews.id WHERE can_feature=1 AND moderation_status='approved' AND COALESCE(e.archived,0)=0 GROUP BY rating").all()) {
      dist[row.rating] = row.n;
      count += row.n;
      sum += row.rating * row.n;
    }
    res.json({
      reviews,
      total,
      limit,
      offset,
      summary: {
        count,
        average: count ? Number((sum / count).toFixed(1)) : 0,
        distribution: dist
      }
    });
  }));
  app.post('/api/reviews', publicRate, asyncRoute(async (req, res) => {
    const name = text(req.body.name, 'Name', 2, 120);
    const message = text(req.body.message, 'Feedback', 1, 3000);
    const rating = integer(req.body.rating, 'Rating', 1, 5);
    const event = optional(req.body.eventType ?? req.body.event_type, 'Event type', 100);
    const pkg = optional(req.body.packageName ?? req.body.package_name, 'Package', 120);
    const consent = boolean(req.body.canFeature, 'Public display consent');
    if (pkg && !(await db.prepare('SELECT id FROM packages WHERE name=?').get(pkg))) fail(400, 'Select a valid package.');
    const row = await db.transaction(async()=>{
      const created=await db.prepare("INSERT INTO reviews(name,event_type,package_name,rating,message,can_feature,moderation_status) VALUES (?,?,?,?,?,?,'pending')").run(name,event,pkg,rating,message,Number(consent));
      await noticeQueue.notify('newReview','/Bouncebash_Admin/blog.html','Customer feedback is awaiting moderation.');
      return created;
    })();
    res.status(201).json({
      success: true,
      reviewId: row.lastInsertRowid,
      message: 'Thank you. Feedback with public-display consent will appear after review by the team.'
    });
  }));
  app.post('/api/newsletter', publicRate, asyncRoute(async (req, res) => {
    const mail = email(req.body.email);
    const raw = token();
    if (await db.prepare('SELECT 1 FROM newsletter_subscribers WHERE email=? COLLATE NOCASE').get(mail)) fail(409, 'This email is already subscribed.');
    await db.transaction(async () => {
      await db.prepare('INSERT INTO newsletter_subscribers(email,unsubscribe_hash) VALUES (?,?)').run(mail, hash(raw));
      const url = new URL('/Bouncebash_CS/account-help.html', config.publicUrl);
      url.hash = `unsubscribe=${raw}`;
      await enqueue(mail, 'newsletter.subscribed', {
        url: url.href,
        message: 'Subscription recorded. Use this link to unsubscribe.'
      });
    })();
    res.status(201).json({
      success: true,
      message: 'Subscription recorded. An unsubscribe link is queued for email delivery.'
    });
  }));
  app.post('/api/newsletter/unsubscribe', publicRate, asyncRoute(async (req, res) => {
    const raw = text(req.body.token, 'Unsubscribe token', 64, 64);
    await db.prepare('DELETE FROM newsletter_subscribers WHERE unsubscribe_hash=?').run(hash(raw));
    res.json({
      success: true,
      message: 'Subscription removed if this link was valid.'
    });
  }));
  // Protected operational APIs. These do not modify or inject code into the original admin panel.
  app.use('/api/operator', asyncRoute(operator), rate('operator', 180, 60000));
  content.registerContent({app,db,audit,asyncRoute,fail,text,optional,integer});
  staffNotices.registerStaffNotices({app,db,audit,asyncRoute,fail});
  require('./backend/operator-overview').registerOverview({app,db,asyncRoute,date,today,fail});
  app.post('/api/operator/bookings/:reference/reschedule',rescheduleBooking);
  app.post('/api/operator/bookings/:reference/payments',recordPaymentReference);
  app.post('/api/operator/maintenance', asyncRoute(async (req, res) => {
    await maintenance();
    await deliverScheduledNotices();
    res.json({
      success: true
    });
  }));
  app.get('/api/operator/catalog', asyncRoute(async (req, res) => res.json({
    packages: await db.prepare('SELECT * FROM packages ORDER BY id').all(),
    addOns: await db.prepare('SELECT * FROM add_ons ORDER BY id').all(),
    zones: await db.prepare('SELECT * FROM rental_zones ORDER BY id').all(),
    models: await db.prepare('SELECT * FROM rental_models ORDER BY id').all(),
    variants: await db.prepare('SELECT * FROM model_variants ORDER BY id').all(),
    packageModels: await db.prepare('SELECT * FROM package_models ORDER BY package_id,model_id').all(),
    options: await db.prepare('SELECT * FROM add_on_options ORDER BY id').all()
  })));
  app.post('/api/operator/catalog/packages', asyncRoute(async (req, res) => {
    const name = text(req.body.name, 'Package name', 2, 120);
    const description = optional(req.body.description, 'Description', 1000);
    const r = await db.prepare('INSERT INTO packages(name,description) VALUES (?,?)').run(name, description);
    await audit(req.actor, 'package.created', 'package', r.lastInsertRowid);
    res.status(201).json({
      success: true,
      id: r.lastInsertRowid
    });
  }));
  app.post('/api/operator/catalog/add-ons', asyncRoute(async (req, res) => {
    const name = text(req.body.name, 'Add-on name', 2, 120);
    const description = optional(req.body.description, 'Description', 1000);
    const r = await db.prepare('INSERT INTO add_ons(name,description) VALUES (?,?)').run(name, description);
    await audit(req.actor, 'addon.created', 'add_on', r.lastInsertRowid);
    res.status(201).json({
      success: true,
      id: r.lastInsertRowid
    });
  }));
  app.get('/api/operator/bookings', asyncRoute(async (req, res) => {
    const limit = integer(req.query.limit ?? 50, 'Limit', 1, 200);
    const offset = integer(req.query.offset ?? 0, 'Offset', 0, 1000000);
    const filters = [];
    const params = [];
    if (req.query.status) {
      if (!['pending', 'confirmed', 'cancelled', 'expired', 'completed'].includes(req.query.status)) fail(400, 'Invalid status.');
      filters.push('status=?');
      params.push(req.query.status);
    }
    if (req.query.from) {
      filters.push('event_date>=?');
      params.push(date(req.query.from));
    }
    if (req.query.to) {
      filters.push('event_date<=?');
      params.push(date(req.query.to));
    }
    if(req.query.search){
      const term='%'+text(req.query.search,'Search',1,120).toLowerCase()+'%';
      filters.push('(LOWER(reference_code) LIKE ? OR LOWER(name) LIKE ? OR LOWER(contact_number) LIKE ?)');
      params.push(term,term,term);
    }
    if(req.query.payment){
      const verified="COALESCE((SELECT SUM(amount_cents) FROM payments WHERE booking_id=bookings.id AND status='verified'),0)";
      const paymentFilters={unpaid:verified+'=0',balance:'total_cents>'+verified,paid:'total_cents<='+verified,
        pending:"EXISTS (SELECT 1 FROM payments WHERE booking_id=bookings.id AND status='pending')"};
      if(!Object.hasOwn(paymentFilters,req.query.payment))fail(400,'Invalid payment filter.');
      filters.push(paymentFilters[req.query.payment]);
    }
    const order=req.query.sort==='soonest'?'event_date,event_time,id':req.query.sort==='latest'?'event_date DESC,event_time DESC,id DESC':'id DESC';
    const where = filters.length ? ' WHERE ' + filters.join(' AND ') : '';
    res.json({
      bookings: await Promise.all((await db.prepare('SELECT * FROM bookings' + where + ' ORDER BY ' + order + ' LIMIT ? OFFSET ?').all(...params, limit, offset)).map(bookingView)),
      total: (await db.prepare('SELECT COUNT(*) AS n FROM bookings' + where).get(...params)).n
    });
  }));
  app.post('/api/operator/bookings', asyncRoute(async (req,res) => res.status(201).json(await createBooking(req.body,null,req.actor))));
  app.get('/api/operator/bookings/:reference', asyncRoute(async (req, res) => res.json({
    booking: await bookingView(await getBooking(req.params.reference))
  })));
  app.put('/api/operator/bookings/:reference/quote', asyncRoute(async (req, res) => {
    const b = await getBooking(req.params.reference);
    if (b.status !== 'pending') fail(409, 'Only pending bookings can be quoted.');
    const total = money(req.body.total, 'Total');
    const deposit = Math.ceil(total / 2);
    const quoteNote = text(req.body.note, 'Quote explanation', 2, 1000);
    await db.transaction(async () => {
      await assertBookingState(b);
      const committed = (await db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS n FROM payments WHERE booking_id=? AND status IN ('pending','verified')").get(b.id)).n;
      if (total < committed) fail(409, 'Quote cannot be lower than pending and verified payments.');
      await db.prepare("UPDATE bookings SET total_cents=?,deposit_cents=?,quote_json=?,pricing_state='final',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(total, deposit, JSON.stringify({
        ...JSON.parse(b.quote_json||'{}'),
        pricing_state:'final',original_subtotal_cents:b.subtotal_cents,
        currency: 'PHP',
        total_cents: total,
        deposit_cents: deposit,
        source: 'operator',
        note: quoteNote
      }), b.id);
      await audit(req.actor, 'booking.quoted', 'booking', b.id, {
        total_cents: total,
        deposit_cents: deposit,
        note: quoteNote
      });
      await notifyBooking(b, 'booking.quoted', `Quote: PHP ${(total / 100).toFixed(2)}; 50% deposit: PHP ${(deposit / 100).toFixed(2)}. Contact the team for official payment instructions.`);
    })();
    res.json({
      success: true,
      booking: await bookingView(await getBooking(b.reference_code))
    });
  }));
  app.put('/api/operator/bookings/:reference/status', asyncRoute(async (req, res) => {
    const b = await getBooking(req.params.reference);
    const target = req.body.status;
    const transitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled'],
      cancelled: [],
      expired: [],
      completed: []
    };
    if (!(transitions[b.status] || []).includes(target)) fail(409, 'Invalid booking status transition.');
    const reason = target === 'cancelled' ? text(req.body.reason, 'Cancellation reason', 2, 1000) : '';
    await db.transaction(async () => {
      await assertBookingState(b);
      if (target === 'confirmed') {
        requireFutureBooking(b);
        const paid = (await db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS n FROM payments WHERE booking_id=? AND status='verified'").get(b.id)).n;
        if (!b.total_cents || paid < b.deposit_cents) fail(409, 'A quote and verified 50% deposit are required before confirmation.');
        if (!(await available(b.event_date, b.id))) fail(409, 'Another booking occupies this date.');
      }
      if (target === 'completed') {
        if (new Date(`${b.event_date}T${b.event_time}:00+08:00`).getTime() > Date.now()) fail(409, 'A future event cannot be marked completed.');
        const paid = (await db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS n FROM payments WHERE booking_id=? AND status='verified'").get(b.id)).n;
        if (paid < b.total_cents) fail(409, 'Verify the full payment before completing the booking.');
      }
      await db.prepare('UPDATE bookings SET status=?,expires_at=NULL,cancellation_reason=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(target, reason, b.id);
      await audit(req.actor, `booking.${target}`, 'booking', b.id, {
        reason
      });
      await notifyBooking(b, `booking.${target}`, `Booking ${target}.${reason ? ` Reason: ${reason}` : ''}`);
    }).immediate();
    res.json({
      success: true,
      booking: await bookingView(await getBooking(b.reference_code))
    });
  }));
  app.get('/api/operator/payments/:id/proof', asyncRoute(async (req, res) => {
    const id = integer(req.params.id, 'Payment ID', 1, Number.MAX_SAFE_INTEGER);
    sendProof(res, await db.prepare('SELECT media_type,image FROM payment_proofs WHERE payment_id=?').get(id));
  }));
  app.put('/api/operator/payments/:id', asyncRoute(async (req, res) => {
    const id = integer(req.params.id, 'Payment ID', 1, Number.MAX_SAFE_INTEGER);
    const target = req.body.status;
    const note = text(req.body.note, 'Verification / refund note', 2, 1000);
    await db.transaction(async () => {
      const p = await db.prepare('SELECT * FROM payments WHERE id=?').get(id);
      if (!p) fail(404, 'Payment not found.');
      if (!(p.status === 'pending' && ['verified', 'rejected'].includes(target) || p.status === 'verified' && target === 'refunded')) fail(409, 'Invalid payment status transition.');
      const b = await db.prepare('SELECT * FROM bookings WHERE id=?').get(p.booking_id);
      if (target === 'verified') {
        if (!['pending','confirmed','expired','cancelled'].includes(b.status))fail(409,'Payment requires separate staff resolution.');
        const paid = (await db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS n FROM payments WHERE booking_id=? AND status='verified'").get(b.id)).n;
        if (!b.total_cents || paid + p.amount_cents > b.total_cents) fail(409, 'Verified payments would exceed the quoted total.');
      }
      if (target === 'refunded' && !['cancelled', 'expired'].includes(b.status)) fail(409, 'Cancel the booking before recording a refund. Refund status records an external refund and does not send money.');
      await db.prepare('UPDATE payments SET status=?,review_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(target, note, id);
      await audit(req.actor, `payment.${target}`, 'payment', id, {
        booking_id: b.id,
        amount_cents: p.amount_cents,
        note
      });
      await notifyBooking(b, `payment.${target}`, `Payment reference ${p.reference}: ${target}. ${note}`);
    }).immediate();
    res.json({
      success: true,
      message: `Payment marked ${target}. Booking availability is unchanged; expired/cancelled bookings remain inactive. No funds were moved by the website.`
    });
  }));
  app.get('/api/operator/reviews', asyncRoute(async (req, res) => res.json({
    reviews: await db.prepare('SELECT reviews.*,e.correction,e.featured,e.archived FROM reviews LEFT JOIN review_editorial e ON e.review_id=reviews.id ORDER BY id DESC LIMIT 200').all()
  })));
  app.put('/api/operator/reviews/:id', asyncRoute(async (req, res) => {
    const id = integer(req.params.id, 'Review ID', 1, Number.MAX_SAFE_INTEGER);
    const status = req.body.status;
    if (!['approved', 'rejected', 'pending'].includes(status)) fail(400, 'Invalid moderation status.');
    await db.transaction(async () => {
      if (!(await db.prepare('UPDATE reviews SET moderation_status=? WHERE id=?').run(status, id)).changes) fail(404, 'Review not found.');
      await audit(req.actor, 'review.moderated', 'review', id, {
        status
      });
    })();
    res.json({
      success: true
    });
  }));
  app.put('/api/operator/catalog/:kind(packages|add-ons)/:id', asyncRoute(async (req, res) => {
    const table = {
      packages: 'packages',
      'add-ons': 'add_ons'
    }[req.params.kind];
    if (!table) fail(404, 'Catalog type not found.');
    const id = integer(req.params.id, 'Catalog ID', 1, Number.MAX_SAFE_INTEGER);
    const active = boolean(req.body.active, 'Active');
    const description = optional(req.body.description, 'Description', 1000);
    await db.transaction(async () => {
      if (!(await db.prepare(`UPDATE ${table} SET is_active=?,description=? WHERE id=?`).run(active ? 1 : 0, description, id)).changes) fail(404, 'Catalog item not found.');
      await audit(req.actor, 'catalog.updated', table, id, {
        active
      });
    })();
    res.json({
      success: true
    });
  }));
  app.get('/api/operator/audit', asyncRoute(async (req, res) => {
    const limit = integer(req.query.limit ?? 100, 'Limit', 1, 500);
    const offset = integer(req.query.offset ?? 0, 'Offset', 0, 1000000);
    res.json({
      events: await db.prepare('SELECT * FROM audit_events ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset)
    });
  }));
  app.get('/api/operator/notifications', asyncRoute(async (req, res) => {
    // Delivery payloads may contain one-use reset tokens: deliberately exclude them from the HTTP API.
    res.json({
      notifications: await db.prepare('SELECT id,kind,status,attempts,created_at,sent_at,last_error FROM notifications ORDER BY id DESC LIMIT 200').all(),
      provider_configured: !!config.webhookUrl
    });
  }));
  app.post('/api/operator/notifications/:id/retry', asyncRoute(async (req, res) => {
    const id = integer(req.params.id, 'Notification ID', 1, Number.MAX_SAFE_INTEGER);
    if (!(await db.prepare("UPDATE notifications SET status='pending',attempts=0,next_attempt_at=?,last_error=NULL WHERE id=? AND status='failed'").run(now(), id)).changes) fail(409, 'Only failed notifications can be retried.');
    res.json({
      success: true
    });
  }));
  // Customer catalog/quotes and operational contracts; no changes to the admin UI.
  const bookingDomain=rules.domain({db,fail,text,optional,integer,loadPricing:()=>content.setting(db,'pricing')});
  const catalogSelection=bookingDomain.select;
  const quoteForSelection=bookingDomain.quote;
  async function calculateQuote(body){const quote=quoteForSelection(await catalogSelection(body));return {...quote,review_token:hash(JSON.stringify(quote))};}
  app.post('/api/quotes', quoteRate, asyncRoute(async (req, res) => res.json({
    quote: await calculateQuote(req.body)
  })));
  const submitInquiry = asyncRoute(async (req, res) => {
    const name = text(req.body.name, 'Name', 2, 120);
    const contact = phone(req.body.contact);
    const mail = req.user ? req.user.email : req.body.email ? email(req.body.email) : '';
    const day = date(req.body.eventDate, true);
    const time = eventTime(req.body.eventTime);
    eventDateTime(day, time);
    const venue = text(req.body.venue, 'Venue', 2, 1000);
    const notes = optional(req.body.notes, 'Notes', 3000);
    const selection = await catalogSelection(req.body);
    const details = {
      name,
      contact,
      email: mail,
      eventDate: day,
      eventTime: time,
      venue,
      notes,
      packageName: selection.pkg.name,
      modelId: selection.modelId,
      variantId: selection.variantId,
      packageId:selection.pkg.id,
      cityId:selection.city.id,extraHours:selection.extraHours,
      addOns: selection.items.map(i => i.name),
      addOnItems: selection.items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        optionId:i.optionId,color:i.color,colors:i.colors,eventType:i.eventType,otherEvent:i.otherEvent
      })),
      selectedStyle: optional(req.body.selectedStyle, 'Style', 120)
    };
    const u = req.user || await userFor(req);
    const id = await db.transaction(async () => {
      const r = await db.prepare('INSERT INTO inquiries(customer_id,name,email,contact,details) VALUES (?,?,?,?,?)').run(u ? u.id : null, name, mail, contact, JSON.stringify(details));
      await audit(u ? `customer:${u.id}` : 'guest', 'inquiry.created', 'inquiry', r.lastInsertRowid);
      await enqueue(mail, 'inquiry.created', {
        inquiryId: r.lastInsertRowid,
        message: 'Your inquiry was received. It does not reserve a date.'
      });
      return r.lastInsertRowid;
    })();
    res.status(201).json({
      success: true,
      inquiryId: id,
      message: 'Inquiry received. This does not reserve or block the requested date.'
    });
  });
  app.post('/api/inquiries', publicRate, submitInquiry);
  app.post('/api/inquiries/mine', asyncRoute(auth), publicRate, submitInquiry);
  app.get('/api/inquiries/mine', asyncRoute(auth), asyncRoute(async (req, res) => res.json({
    inquiries: await db.prepare('SELECT id,details,status,reply,booking_id,created_at FROM inquiries WHERE customer_id=? ORDER BY id DESC LIMIT 200').all(req.user.id)
  })));
  app.get('/api/operator/inquiries', asyncRoute(async (req, res) => {
    const status = req.query.status || '';
    if (status && !['new', 'replied', 'converted'].includes(status)) fail(400, 'Invalid inquiry status.');
    const limit = integer(req.query.limit ?? 50, 'Limit', 1, 200);
    const offset = integer(req.query.offset ?? 0, 'Offset', 0, 1000000);
    const rows = status ? await db.prepare('SELECT * FROM inquiries WHERE status=? ORDER BY id DESC LIMIT ? OFFSET ?').all(status, limit, offset) : await db.prepare('SELECT * FROM inquiries ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset);
    res.json({
      inquiries: rows
    });
  }));
  app.post('/api/operator/inquiries/:id/reply', asyncRoute(async (req, res) => {
    const id = integer(req.params.id, 'Inquiry ID', 1, 1000000);
    const reply = text(req.body.reply, 'Reply', 2, 3000);
    await db.transaction(async () => {
      const row = await db.prepare('SELECT * FROM inquiries WHERE id=?').get(id);
      if (!row) fail(404, 'Inquiry not found.');
      if (row.status === 'converted') fail(409, 'Inquiry already converted.');
      await db.prepare("UPDATE inquiries SET status='replied',reply=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(reply, id);
      await enqueue(row.email, 'inquiry.replied', {
        inquiryId: id,
        message: reply
      });
      await audit(req.actor, 'inquiry.replied', 'inquiry', id);
    })();
    res.json({
      success: true,
      message: 'Reply recorded. Email is queued when a recipient email was supplied.'
    });
  }));
  app.post('/api/operator/inquiries/:id/convert', asyncRoute(async (req, res) => {
    const id = integer(req.params.id, 'Inquiry ID', 1, 1000000);
    const result = await db.transaction(async () => {
      const row = await db.prepare('SELECT * FROM inquiries WHERE id=?').get(id);
      if (!row) fail(404, 'Inquiry not found.');
      if (row.booking_id) {
        const b = await db.prepare('SELECT * FROM bookings WHERE id=?').get(row.booking_id);
        return {
          success: true,
          alreadyConverted: true,
          booking: {
            id: b.id,
            reference: b.reference_code
          }
        };
      }
      if (!boolean(req.body.customerAcceptedFee, 'Customer fee acknowledgement')) fail(400, 'Record the customer acknowledgement of the 50% fee before conversion.');
      const u = row.customer_id ? await db.prepare('SELECT * FROM customers WHERE id=?').get(row.customer_id) : null;
      const created = await createBooking({
        ...JSON.parse(row.details),
        reservationFeeAccepted: true
      }, u, req.actor);
      await db.prepare("UPDATE inquiries SET status='converted',booking_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(created.booking.id, id);
      await audit(req.actor, 'inquiry.converted', 'inquiry', id, {
        booking_id: created.booking.id
      });
      return created;
    }).immediate();
    res.status(result.alreadyConverted ? 200 : 201).json(result);
  }));
  app.post('/api/operator/catalog/models', asyncRoute(async (req, res) => {
    const zone = integer(req.body.zoneId, 'Zone', 1, 1000000);
    const name = text(req.body.name, 'Model name', 2, 120);
    const capacity = integer(req.body.capacity, 'Model capacity', 1, 1000);
    const description = optional(req.body.description, 'Description', 1000);
    const image = optional(req.body.imageUrl, 'Image URL', 300);
    if (image && !/^\/assets\/photos\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(image)) fail(400, 'Use a local /assets/photos image path.');
    if (!(await db.prepare('SELECT 1 FROM rental_zones WHERE id=?').get(zone))) fail(400, 'Zone not found.');
    const id = await db.transaction(async () => {
      const r = await db.prepare('INSERT INTO rental_models(zone_id,name,description,capacity,image_url) VALUES (?,?,?,?,?)').run(zone, name, description, capacity, image);
      if(req.body.includesBalls!==undefined)await db.prepare('UPDATE rental_models SET includes_balls=? WHERE id=?').run(boolean(req.body.includesBalls,'Includes balls')?1:0,r.lastInsertRowid);
      if(req.body.active===false)await db.prepare('UPDATE rental_models SET is_active=0 WHERE id=?').run(r.lastInsertRowid);
      if(req.body.packageId)await linkOffer(r.lastInsertRowid,req.body.packageId);
      await audit(req.actor, 'model.created', 'model', r.lastInsertRowid);
      return r.lastInsertRowid;
    })();
    res.status(201).json({
      success: true,
      id
    });
  }));
  async function linkOffer(modelId,value){
    const id=value===''?null:integer(value,'Booking offer',1,1000000);
    if(id){
      if(!await db.prepare('SELECT 1 FROM packages WHERE id=?').get(id))fail(400,'Booking offer not found.');
      await db.prepare('INSERT OR IGNORE INTO package_models(package_id,model_id) VALUES (?,?)').run(id,modelId);
    }
    await db.prepare('UPDATE rental_models SET booking_package_id=? WHERE id=?').run(id,modelId);
  }
  app.put('/api/operator/catalog/models/:id', asyncRoute(async (req, res) => {
    const id = integer(req.params.id, 'Model ID', 1, 1000000);
    const active = boolean(req.body.active, 'Active');
    const capacity = integer(req.body.capacity, 'Capacity', 1, 1000);
    await db.transaction(async()=>{
      const before=await db.prepare('SELECT * FROM rental_models WHERE id=?').get(id);
      if(!before)fail(404,'Model not found.');
      const name=req.body.name===undefined?before.name:text(req.body.name,'Name',2,120);
      const description=req.body.description===undefined?before.description:optional(req.body.description,'Description',1000);
      const image=req.body.imageUrl===undefined?before.image_url:optional(req.body.imageUrl,'Image',300);
      const zone=integer(req.body.zoneId??before.zone_id,'Zone',1,1000000);
      if(!await db.prepare('SELECT 1 FROM rental_zones WHERE id=?').get(zone))fail(400,'Zone not found.');
      if(image&&!/^\/assets\/photos\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(image))fail(400,'Use a local /assets/photos image path.');
      const balls=req.body.includesBalls===undefined?before.includes_balls:Number(boolean(req.body.includesBalls,'Includes balls'));
      await db.prepare('UPDATE rental_models SET is_active=?,capacity=?,name=?,description=?,image_url=?,zone_id=?,includes_balls=? WHERE id=?').run(Number(active),capacity,name,description,image,zone,balls,id);
      if(req.body.packageId!==undefined)await linkOffer(id,req.body.packageId);
      await audit(req.actor,'model.updated','model',id,{before,after:{active,capacity,name,description,image,zone,balls,packageId:req.body.packageId}});
    })();
    res.json({
      success: true
    });
  }));
  app.post('/api/operator/catalog/variants', asyncRoute(async (req, res) => {
    const modelId = integer(req.body.modelId, 'Model ID', 1, 1000000);
    const name = text(req.body.name, 'Variant name', 1, 120);
    if (!(await db.prepare('SELECT 1 FROM rental_models WHERE id=?').get(modelId))) fail(400, 'Model not found.');
    const r = await db.prepare('INSERT INTO model_variants(model_id,name) VALUES (?,?)').run(modelId, name);
    await audit(req.actor, 'variant.created', 'variant', r.lastInsertRowid);
    res.status(201).json({
      success: true,
      id: r.lastInsertRowid
    });
  }));
  app.post('/api/operator/catalog/options', asyncRoute(async (req, res) => {
    const addon = integer(req.body.addOnId, 'Add-on ID', 1, 1000000);
    const name = text(req.body.name, 'Color/decor option', 1, 120);
    if (!(await db.prepare('SELECT 1 FROM add_ons WHERE id=?').get(addon))) fail(400, 'Add-on not found.');
    const r = await db.prepare('INSERT INTO add_on_options(add_on_id,name) VALUES (?,?)').run(addon, name);
    await audit(req.actor, 'option.created', 'option', r.lastInsertRowid);
    res.status(201).json({
      success: true,
      id: r.lastInsertRowid
    });
  }));
  app.put('/api/operator/catalog/variants/:id', asyncRoute(async (req, res) => {
    const id = integer(req.params.id, 'Variant ID', 1, 1000000);
    const active = boolean(req.body.active, 'Active');
    if (!(await db.prepare('UPDATE model_variants SET is_active=? WHERE id=?').run(active ? 1 : 0, id)).changes) fail(404, 'Variant not found.');
    await audit(req.actor, 'variant.updated', 'variant', id, {
      active
    });
    res.json({
      success: true
    });
  }));
  app.put('/api/operator/catalog/options/:id', asyncRoute(async (req, res) => {
    const id = integer(req.params.id, 'Option ID', 1, 1000000);
    const active = boolean(req.body.active, 'Active');
    if (!(await db.prepare('UPDATE add_on_options SET is_active=? WHERE id=?').run(active ? 1 : 0, id)).changes) fail(404, 'Option not found.');
    await audit(req.actor, 'option.updated', 'option', id, {
      active
    });
    res.json({
      success: true
    });
  }));
  app.put('/api/operator/catalog/packages/:id/pricing', asyncRoute(async (req, res) => {
    const id = integer(req.params.id, 'Package ID', 1, 1000000);
    const cents = money(req.body.price, 'Package price');
    const hours = integer(req.body.hours, 'Rental hours', 1, 72);
    if (!Array.isArray(req.body.inclusions) || req.body.inclusions.length > 30) fail(400, 'Provide a list of inclusions.');
    const inclusions = req.body.inclusions.map(v => text(v, 'Inclusion', 1, 200));
    if (!Array.isArray(req.body.modelIds) || req.body.modelIds.length > 100) fail(400, 'Provide supported model IDs.');
    const models = [...new Set(req.body.modelIds.map(v => integer(v, 'Model ID', 1, 1000000)))];
    await db.transaction(async () => {
      if (!(await db.prepare('SELECT 1 FROM packages WHERE id=?').get(id))) fail(404, 'Package not found.');
      for (const model of models) if (!(await db.prepare('SELECT 1 FROM rental_models WHERE id=?').get(model))) fail(400, 'Model not found.');
      await db.prepare('UPDATE packages SET base_price_cents=?,base_price=?,rental_hours=?,inclusions=? WHERE id=?').run(cents, cents / 100, hours, JSON.stringify(inclusions), id);
      await db.prepare('DELETE FROM package_models WHERE package_id=?').run(id);
      for (const model of models) await db.prepare('INSERT INTO package_models VALUES (?,?)').run(id, model);
      await audit(req.actor, 'package.pricing_updated', 'package', id, {
        price_cents: cents,
        hours,
        model_ids: models
      });
    })();
    res.json({
      success: true
    });
  }));
  app.put('/api/operator/catalog/add-ons/:id/pricing', asyncRoute(async (req, res) => {
    const id = integer(req.params.id, 'Add-on ID', 1, 1000000);
    const cents = req.body.price === 0 || req.body.price === '0' ? 0 : money(req.body.price, 'Add-on price');
    const max = integer(req.body.maxQuantity, 'Maximum quantity', 1, 1000);
    if (!(await db.prepare('UPDATE add_ons SET unit_price_cents=?,max_quantity=? WHERE id=?').run(cents, max, id)).changes) fail(404, 'Add-on not found.');
    await audit(req.actor, 'addon.pricing_updated', 'add_on', id, {
      price_cents: cents,
      max_quantity: max
    });
    res.json({
      success: true
    });
  }));
  app.get('/api/operator/date-blocks', asyncRoute(async (req, res) => res.json({
    blocks: await db.prepare('SELECT * FROM date_blocks ORDER BY event_date').all()
  })));
  app.post('/api/operator/date-blocks', asyncRoute(async (req, res) => {
    const day = date(req.body.date, true);
    const reason = text(req.body.reason, 'Block reason', 2, 1000);
    await db.transaction(async () => {
      if (!(await available(day))) fail(409, 'This date already has a booking or block; resolve it first.');
      await db.prepare('INSERT INTO date_blocks(event_date,reason) VALUES (?,?)').run(day, reason);
      await audit(req.actor, 'date.blocked', 'date', day, {
        reason
      });
    }).immediate();
    res.status(201).json({
      success: true
    });
  }));
  app.post('/api/operator/date-blocks/:date/remove', asyncRoute(async (req, res) => {
    const day = date(req.params.date);
    await db.prepare('DELETE FROM date_blocks WHERE event_date=?').run(day);
    await audit(req.actor, 'date.unblocked', 'date', day);
    res.json({
      success: true
    });
  }));
  app.post('/api/staff/login', authRate, asyncRoute(async (req, res) => {
    const mail = email(req.body.email);
    const pass = credential(req.body.password);
    const staff = await db.prepare('SELECT * FROM staff_users WHERE email=?').get(mail);
    const valid = await bcrypt.compare(pass, staff ? staff.password_hash : dummyHash);
    if (!staff || !valid) fail(401, 'Invalid email or password.');
    const raw = token();
    await db.prepare('INSERT INTO staff_sessions(id,staff_id,token,expires_at) VALUES (?,?,?,?)').run(crypto.randomUUID(), staff.id, hash(raw), new Date(Date.now() + 8 * 3600000).toISOString());
    res.cookie('staff_session', raw, { ...cookieOptions, maxAge: 8 * 3600000 });
    res.json({ success: true, name: staff.name });
  }));
  app.post('/api/staff/logout', asyncRoute(async (req, res) => {
    if (typeof req.cookies.staff_session === 'string') await db.prepare('DELETE FROM staff_sessions WHERE token=?').run(hash(req.cookies.staff_session));
    res.clearCookie('staff_session', cookieOptions);
    res.json({ success: true });
  }));
  app.get('/api/staff/session', asyncRoute(async (req, res) => {
    const staff = await staffFor(req);
    res.json(staff ? { authenticated: true, name: staff.name } : { authenticated: false });
  }));
  app.use('/api', (req, res) => res.status(404).json({
    error: 'API endpoint not found.'
  }));
  // Explicit public mounts only. Never serve data, source, .env, tests, scripts, or dependencies.
  const publicOptions = {
    dotfiles: 'deny',
    index: 'index.html',
    fallthrough: true,
    etag: true
  };
  app.use('/assets', express.static(path.join(__dirname, 'assets'), publicOptions));
  app.use('/js', express.static(path.join(__dirname, 'js'), publicOptions));
  app.get('/site.js', (req, res) => res.sendFile(path.join(__dirname, 'site.js')));
  app.use('/Bouncebash_CS', (req, res, next) => {
    if (!/^\/(?:[a-zA-Z0-9_-]+\.(?:html|css|js|png|jpg|jpeg|svg|webp)|)?$/.test(req.path)) return res.status(404).send('Not found.');
    next();
  }, express.static(path.join(__dirname, 'Bouncebash_CS'), publicOptions));
  app.use('/Bouncebash_Admin', asyncRoute(async (req, res, next) => {
    const isPage = req.path === '/' || req.path.endsWith('.html');
    if (isPage && req.path !== '/login.html' && !(await staffFor(req))) return res.redirect('/Bouncebash_Admin/login.html');
    next();
  }));
  app.use('/Bouncebash_Admin', (req, res, next) => {
    if (!/^\/(?:[a-zA-Z0-9_/-]+\.(?:html|css|js|png|jpg|jpeg|svg|webp)|)?$/.test(req.path)) return res.status(404).send('Not found.');
    next();
  }, express.static(path.join(__dirname, 'Bouncebash_Admin'), publicOptions));
  app.get('/', (req, res) => res.redirect('/Bouncebash_CS/index.html'));
  app.use((req, res) => res.status(404).type('text').send('Not found.'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = error.status || 500;
    let message = error.message;
    if (error.type === 'entity.parse.failed') {
      status = 400;
      message = 'Request body must be valid JSON.';
    }
    if (error.type === 'entity.too.large') {
      status = 413;
      message = 'Request body exceeds the 64 KB limit.';
    }
    if (['SQLITE_CONSTRAINT_UNIQUE', '23505'].includes(error.code)) {
      status = 409;
      message = 'This entry already exists. Check for a duplicate email or payment reference.';
    }
    if (status >= 500) {
      if (process.env.BOUNCEBASH_DEBUG === '1' && !config.production) console.error(error.stack);
      console.error(JSON.stringify({
        time: now(),
        event: 'server.error',
        code: error.code || 'INTERNAL',
        path: req.path
      }));
      message = 'A server error occurred. Please try again.';
    }
    res.status(status).json({
      error: message
    });
  });
  await maintenance();
  const timer = require.main === module ? setInterval(async () => {
    try {
      await maintenance();
    } catch (e) {
      console.error('Maintenance failed:', e.code || 'INTERNAL');
    }
    void deliverScheduledNotices().catch(e => console.error('Notification worker failed:', e.code || 'DELIVERY_ERROR'));
  }, 30000) : null;
  if (timer) timer.unref();
  const server = require.main === module ? app.listen(config.port, config.host, () => {
    console.log(`Bounce Bash customer server: ${config.publicUrl.origin}/Bouncebash_CS/`);
    console.log(db.driver === 'sqlite' ? `SQLite database: ${require('./backend/database').dbPath}` : `Database driver: ${db.driver}`);
    if (!config.webhookUrl) console.log('Email delivery is not configured. Notifications remain in the private outbox; see README.md.');
    if (!config.operatorKey) console.log('Operator API disabled. Set OPERATOR_API_KEY in .env to enable it.');
  }) : null;
  function shutdown() {
    clearInterval(timer);
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  }
  if (require.main === module) {
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
  return app;
}
const ready = start();
if (require.main === module) ready.catch(error => {
  console.error('Startup failed:', error.code || error.message);
  process.exit(1);
});
module.exports = async (req, res) => {
  try {
    const app = await ready;
    return app(req, res);
  } catch (error) {
    console.error('Startup failed:', error.code || error.message);
    res.statusCode = 503;
    res.end('Server configuration unavailable.');
  }
};
if (require.main === module) ready.catch(error => {
  console.error('Startup failed:', error.message);
  process.exit(1);
});
