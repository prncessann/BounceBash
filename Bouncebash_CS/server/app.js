require('dotenv').config();

const crypto = require('node:crypto');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const express = require('express');
const session = require('express-session');
const { rateLimit } = require('express-rate-limit');
const helmet = require('helmet');
const { z } = require('zod');
const { createDatabase } = require('./database');
const { SqliteSessionStore } = require('./sqlite-session-store');
const { deliverOutbox, enqueueEmail, isConfigured, sendEmail } = require('./email');
const { registerStaffRoutes } = require('./staff-routes');
const { passwordSchema } = require('./validation');

const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3000);
const sessionSecret = process.env.SESSION_SECRET || '';

if (isProduction && (sessionSecret.length < 32 || sessionSecret.includes('replace-with-'))) {
  throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
}
if (isProduction && process.env.PUBLIC_BASE_URL) {
  let publicUrl;
  try { publicUrl = new URL(process.env.PUBLIC_BASE_URL); } catch { throw new Error('PUBLIC_BASE_URL must be a valid HTTPS URL in production.'); }
  if (publicUrl.protocol !== 'https:' || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash) {
    throw new Error('PUBLIC_BASE_URL must be a valid HTTPS URL in production.');
  }
}
if (isProduction && isConfigured() && !process.env.PUBLIC_BASE_URL) {
  throw new Error('PUBLIC_BASE_URL is required in production when SMTP email is configured.');
}
const app = express();
const db = createDatabase(process.env.DATABASE_PATH || './data/bouncebash.sqlite');
if (isProduction) app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: '20kb' }));
app.use(session({
  name: 'bouncebash.sid',
  secret: sessionSecret || crypto.randomBytes(48).toString('hex'),
  store: new SqliteSessionStore(db),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    const fetchSite = req.get('sec-fetch-site');
    if (fetchSite === 'cross-site' || (origin && origin !== `${req.protocol}://${req.get('host')}`)) {
      return res.status(403).json({ error: 'Request origin is not allowed.' });
    }
  }
  next();
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: process.env.NODE_ENV === 'test' ? 1000 : 10, standardHeaders: 'draft-8', legacyHeaders: false });
const bookingLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: process.env.NODE_ENV === 'test' ? 1000 : 20, standardHeaders: 'draft-8', legacyHeaders: false });
const tokenLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: process.env.NODE_ENV === 'test' ? 1000 : 5, standardHeaders: 'draft-8', legacyHeaders: false });

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().max(254),
  contact: z.string().trim().min(7).max(30),
  password: passwordSchema(10)
});
const loginSchema = z.object({ email: z.email().trim().max(254), password: passwordSchema(1) });
const bookingSchema = z.object({
  packageId: z.string().min(1).max(80),
  modelId: z.string().min(1).max(80),
  eventDate: z.iso.date().refine(isValidDate),
  eventTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  venue: z.string().trim().min(5).max(500),
  childrenCount: z.number().int().min(1).max(1000),
  notes: z.string().trim().max(2000).default(''),
  addonIds: z.array(z.string().min(1).max(80)).max(20).default([])
});

function customerView(customer) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    contact: customer.contact,
    emailVerified: Boolean(customer.email_verified)
  };
}

function requireCustomer(req, res, next) {
  const customerId = req.session.customerId;
  if (!customerId) return res.status(401).json({ error: 'Please log in to continue.' });
  const customer = db.prepare('SELECT active, session_version FROM customers WHERE id = ?').get(customerId);
  if (!customer?.active || customer.session_version !== (req.session.customerVersion ?? 0)) {
    return req.session.destroy(() => res.status(401).json({ error: 'Please log in to continue.' }));
  }
  next();
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1000 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function todayInManila() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function issueCustomerToken(customerId, purpose, data = null) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return db.transaction(() => {
    db.prepare('UPDATE customer_tokens SET used_at = ? WHERE customer_id = ? AND purpose = ? AND used_at IS NULL')
      .run(Date.now(), customerId, purpose);
    db.prepare(`INSERT INTO customer_tokens (customer_id, purpose, token_hash, data, expires_at)
      VALUES (?, ?, ?, ?, ?)`).run(customerId, purpose, tokenHash, data === null ? null : JSON.stringify(data), Date.now() + 60 * 60 * 1000);
    return token;
  }).immediate();
}

function issueNewsletterToken(subscriptionId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return db.transaction(() => {
    db.prepare('UPDATE newsletter_tokens SET used_at = ? WHERE subscription_id = ? AND used_at IS NULL')
      .run(Date.now(), subscriptionId);
    db.prepare('INSERT INTO newsletter_tokens (subscription_id, token_hash, expires_at) VALUES (?, ?, ?)')
      .run(subscriptionId, tokenHash, Date.now() + 60 * 60 * 1000);
    return token;
  }).immediate();
}

function devTokenAllowed() {
  return !isProduction && (process.env.NODE_ENV === 'test' || process.env.EMAIL_DEV_TOKEN === 'true');
}

async function deliverAccountToken(email, subject, page, token, flow) {
  const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
  const link = `${baseUrl.replace(/\/$/, '')}/${page}?flow=${encodeURIComponent(flow)}&token=${encodeURIComponent(token)}`;
  await sendEmail({ to: email, subject, text: `Use this one-time link within 60 minutes:\n\n${link}\n\nIf you did not request this, you can ignore this message.` });
}

function validate(schema, req, res) {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Please check the highlighted information.', details: result.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })) });
    return null;
  }
  return result.data;
}

function bookingView(row) {
  return {
    id: row.id,
    eventDate: row.event_date,
    eventTime: row.event_time,
    venue: row.venue,
    childrenCount: row.children_count,
    notes: row.notes,
    status: row.status,
    totalCents: row.total_cents,
    createdAt: row.created_at,
    package: { id: row.package_id, name: row.package_name, priceCents: row.package_price_cents },
    model: { id: row.model_id, name: row.model_name },
    addons: row.addons_json ? JSON.parse(row.addons_json) : []
  };
}

const bookingSelect = `SELECT b.*, COALESCE(b.package_name_snapshot, p.name) AS package_name,
  COALESCE(b.package_price_cents_snapshot, p.price_cents) AS package_price_cents,
  COALESCE(b.model_name_snapshot, m.name) AS model_name,
  (SELECT json_group_array(json_object(
    'id', a.id,
    'name', COALESCE(ba.name_snapshot, a.name),
    'priceCents', COALESCE(ba.price_cents_snapshot, a.price_cents)
  )) FROM booking_addons ba JOIN addons a ON a.id = ba.addon_id WHERE ba.booking_id = b.id) AS addons_json
  FROM bookings b JOIN packages p ON p.id = b.package_id JOIN inflatable_models m ON m.id = b.model_id`;

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/register', authLimiter, async (req, res, next) => {
  const input = validate(registerSchema, req, res);
  if (!input) return;
  try {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const registered = db.transaction(() => {
      const result = db.prepare(`INSERT INTO customers (name, email, contact, password_hash, email_verified)
        VALUES (?, ?, ?, ?, 0)`).run(input.name, input.email.toLowerCase(), input.contact, passwordHash);
      const customerId = Number(result.lastInsertRowid);
      return { customerId, verificationToken: issueCustomerToken(customerId, 'email_verification') };
    }).immediate();
    const { customerId, verificationToken } = registered;
    req.session.regenerate(error => {
      if (error) return next(error);
      req.session.customerId = customerId;
      req.session.customerVersion = 0;
      req.session.save(saveError => {
        if (saveError) return next(saveError);
        const customer = { id: customerId, ...input, email_verified: false };
        deliverAccountToken(input.email, 'Verify your Bounce Bash email', 'account.html', verificationToken, 'verify')
          .catch(error => {
            if (error.code !== 'EMAIL_NOT_CONFIGURED') console.error('Email verification delivery failed:', error.code || 'DELIVERY_FAILED');
          });
        res.status(201).json({
          customer: customerView(customer),
          ...(devTokenAllowed() ? { verificationToken } : {})
        });
      });
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'An account with this email already exists.' });
    next(error);
  }
});

app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  const input = validate(loginSchema, req, res);
  if (!input) return;
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE email = ? COLLATE NOCASE').get(input.email);
    const valid = customer?.active && await bcrypt.compare(input.password, customer.password_hash);
    if (!valid) return res.status(401).json({ error: 'Email or password is incorrect.' });
    req.session.regenerate(error => {
      if (error) return next(error);
      req.session.customerId = customer.id;
      req.session.customerVersion = customer.session_version;
      req.session.save(saveError => {
        if (saveError) return next(saveError);
        res.json({ customer: customerView(customer) });
      });
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', requireCustomer, (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('bouncebash.sid', { httpOnly: true, sameSite: 'lax', secure: isProduction });
    res.status(204).end();
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.customerId) return res.json({ customer: null });
  const customer = db.prepare('SELECT id, name, email, contact, email_verified, active, session_version FROM customers WHERE id = ?').get(req.session.customerId);
  if (!customer?.active || customer.session_version !== (req.session.customerVersion ?? 0)) {
    return req.session.destroy(() => res.json({ customer: null }));
  }
  res.json({ customer: customerView(customer) });
});

app.patch('/api/customer/profile', requireCustomer, (req, res) => {
  const schema = z.object({ name: z.string().trim().min(2).max(100), contact: z.string().trim().min(7).max(30) });
  const input = validate(schema, req, res);
  if (!input) return;
  db.prepare('UPDATE customers SET name = ?, contact = ? WHERE id = ?').run(input.name, input.contact, req.session.customerId);
  res.json({ customer: db.prepare('SELECT id, name, email, contact FROM customers WHERE id = ?').get(req.session.customerId) });
});

app.post('/api/customer/password', requireCustomer, authLimiter, async (req, res, next) => {
  const parsed = z.object({
    currentPassword: z.string().min(1).max(72),
    newPassword: passwordSchema(10)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please provide your current password and a valid new password.' });
  try {
    const customer = db.prepare('SELECT password_hash FROM customers WHERE id = ?').get(req.session.customerId);
    if (!customer || !(await bcrypt.compare(parsed.data.currentPassword, customer.password_hash))) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    db.prepare('UPDATE customers SET password_hash = ?, session_version = session_version + 1 WHERE id = ?')
      .run(passwordHash, req.session.customerId);
    req.session.destroy(error => {
      if (error) return next(error);
      res.clearCookie('bouncebash.sid', { httpOnly: true, sameSite: 'lax', secure: isProduction });
      res.status(200).json({ message: 'Password changed. Please sign in again.' });
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/password-reset', tokenLimiter, async (req, res) => {
  const parsed = z.object({ email: z.email().trim().max(254) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email address.' });
  const customer = db.prepare('SELECT id, email FROM customers WHERE email = ? COLLATE NOCASE AND active = 1').get(parsed.data.email);
  let token;
  if (customer) {
    token = issueCustomerToken(customer.id, 'password_reset');
    deliverAccountToken(customer.email, 'Reset your Bounce Bash password', 'account.html', token, 'reset')
      .catch(error => {
        if (error.code !== 'EMAIL_NOT_CONFIGURED') console.error('Password reset delivery failed:', error.code || 'DELIVERY_FAILED');
      });
  }
  res.json({
    message: 'If an account exists for that email, password reset instructions will be sent.',
    ...(token && devTokenAllowed() ? { resetToken: token } : {})
  });
});

app.post('/api/auth/password-reset/confirm', tokenLimiter, async (req, res) => {
  const parsed = z.object({
    token: z.string().min(32).max(100),
    password: passwordSchema(10)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'The reset link or new password is invalid.' });
  const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const update = db.transaction(() => {
    const token = db.prepare(`SELECT id, customer_id FROM customer_tokens
      WHERE token_hash = ? AND purpose = 'password_reset' AND used_at IS NULL AND expires_at > ?`).get(tokenHash, Date.now());
    if (!token) return false;
    db.prepare('UPDATE customer_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL').run(Date.now(), token.id);
    db.prepare('UPDATE customers SET password_hash = ?, session_version = session_version + 1 WHERE id = ?')
      .run(passwordHash, token.customer_id);
    return true;
  }).immediate();
  if (!update) return res.status(400).json({ error: 'The reset link is invalid or has expired.' });
  res.json({ message: 'Password reset complete. Please sign in.' });
});

app.post('/api/auth/email/verification', requireCustomer, tokenLimiter, (req, res) => {
  const customer = db.prepare('SELECT id, email, email_verified FROM customers WHERE id = ?').get(req.session.customerId);
  if (customer.email_verified) return res.status(409).json({ error: 'This email address is already verified.' });
  const token = issueCustomerToken(customer.id, 'email_verification');
  deliverAccountToken(customer.email, 'Verify your Bounce Bash email', 'account.html', token, 'verify')
    .catch(error => {
      if (error.code !== 'EMAIL_NOT_CONFIGURED') console.error('Email verification delivery failed:', error.code || 'DELIVERY_FAILED');
    });
  res.json({
    message: 'If email delivery is configured, a verification link will be sent.',
    ...(devTokenAllowed() ? { verificationToken: token } : {})
  });
});

app.post('/api/auth/email/verification/confirm', tokenLimiter, (req, res) => {
  const parsed = z.object({ token: z.string().min(32).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'The verification link is invalid or has expired.' });
  const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
  const result = db.transaction(() => {
    const token = db.prepare(`SELECT id, customer_id FROM customer_tokens
      WHERE token_hash = ? AND purpose = 'email_verification' AND used_at IS NULL AND expires_at > ?`).get(tokenHash, Date.now());
    if (!token) return false;
    db.prepare('UPDATE customer_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL').run(Date.now(), token.id);
    db.prepare('UPDATE customers SET email_verified = 1 WHERE id = ?').run(token.customer_id);
    return true;
  }).immediate();
  if (!result) return res.status(400).json({ error: 'The verification link is invalid or has expired.' });
  res.json({ message: 'Email address verified.' });
});

app.post('/api/customer/email-change', requireCustomer, tokenLimiter, async (req, res, next) => {
  const parsed = z.object({
    email: z.email().trim().max(254),
    password: passwordSchema(1)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email address and current password.' });
  try {
    const customer = db.prepare('SELECT email, password_hash FROM customers WHERE id = ?').get(req.session.customerId);
    if (!(await bcrypt.compare(parsed.data.password, customer.password_hash))) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    const email = parsed.data.email.toLowerCase();
    if (email === customer.email.toLowerCase()) return res.status(409).json({ error: 'This is already your email address.' });
    if (db.prepare('SELECT id FROM customers WHERE email = ? COLLATE NOCASE').get(email)) {
      return res.status(409).json({ error: 'That email address cannot be used.' });
    }
    const token = issueCustomerToken(req.session.customerId, 'email_change', { email });
    deliverAccountToken(email, 'Verify your new Bounce Bash email', 'account.html', token, 'email-change')
      .catch(error => {
        if (error.code !== 'EMAIL_NOT_CONFIGURED') console.error('Email change delivery failed:', error.code || 'DELIVERY_FAILED');
      });
    res.json({
      message: 'If email delivery is configured, a verification link will be sent to the new address.',
      ...(devTokenAllowed() ? { verificationToken: token } : {})
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/customer/email-change/confirm', tokenLimiter, (req, res, next) => {
  const parsed = z.object({ token: z.string().min(32).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'The verification link is invalid or has expired.' });
  const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
  const result = db.transaction(() => {
    const token = db.prepare(`SELECT id, customer_id, data FROM customer_tokens
      WHERE token_hash = ? AND purpose = 'email_change' AND used_at IS NULL AND expires_at > ?`).get(tokenHash, Date.now());
    if (!token) return { invalid: true };
    const data = JSON.parse(token.data || '{}');
    const update = db.prepare(`UPDATE customers SET email = ?, email_verified = 1, session_version = session_version + 1
      WHERE id = ? AND NOT EXISTS (SELECT 1 FROM customers WHERE email = ? COLLATE NOCASE AND id != ?)`)
        .run(data.email, token.customer_id, data.email, token.customer_id);
    if (!update.changes) return { conflict: true };
    db.prepare('UPDATE customer_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL').run(Date.now(), token.id);
    return {};
  }).immediate();
  if (result.invalid) return res.status(400).json({ error: 'The verification link is invalid or has expired.' });
  if (result.conflict) return res.status(409).json({ error: 'That email address cannot be used.' });
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('bouncebash.sid', { httpOnly: true, sameSite: 'lax', secure: isProduction });
    res.json({ message: 'Email address updated. Please sign in again.' });
  });
});

app.post('/api/customer/deactivate', requireCustomer, authLimiter, async (req, res, next) => {
  const parsed = z.object({ password: passwordSchema(1), confirm: z.literal(true) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Confirm account deactivation and provide your password.' });
  try {
    const customer = db.prepare('SELECT password_hash FROM customers WHERE id = ?').get(req.session.customerId);
    if (!(await bcrypt.compare(parsed.data.password, customer.password_hash))) {
      return res.status(400).json({ error: 'Password is incorrect.' });
    }
    db.prepare('UPDATE customers SET active = 0, session_version = session_version + 1 WHERE id = ?')
      .run(req.session.customerId);
    req.session.destroy(error => {
      if (error) return next(error);
      res.clearCookie('bouncebash.sid', { httpOnly: true, sameSite: 'lax', secure: isProduction });
      res.json({ message: 'Account deactivated. Booking and financial history is retained.' });
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/catalog', (_req, res) => {
  res.json({
    packages: db.prepare('SELECT id, name, description, price_cents AS priceCents FROM packages WHERE active = 1 ORDER BY price_cents').all(),
    models: db.prepare('SELECT id, name, description, capacity FROM inflatable_models WHERE active = 1 ORDER BY name').all(),
    addons: db.prepare('SELECT id, name, price_cents AS priceCents FROM addons WHERE active = 1 ORDER BY name').all()
  });
});

app.post('/api/newsletter', authLimiter, (req, res, next) => {
  const input = validate(z.object({ email: z.email().trim().max(254), consent: z.literal(true) }), req, res);
  if (!input) return;
  try {
    const email = input.email.toLowerCase();
    const outcome = db.transaction(() => {
      const existing = db.prepare('SELECT id, active FROM newsletter_subscriptions WHERE email = ? COLLATE NOCASE').get(email);
      if (existing?.active) return 'duplicate';
      if (existing) {
        db.prepare(`UPDATE newsletter_subscriptions SET active = 1, subscribed_at = CURRENT_TIMESTAMP,
          consent_at = CURRENT_TIMESTAMP WHERE id = ?`).run(existing.id);
        db.prepare('UPDATE newsletter_tokens SET used_at = ? WHERE subscription_id = ? AND used_at IS NULL')
          .run(Date.now(), existing.id);
      } else {
        db.prepare(`INSERT INTO newsletter_subscriptions (email, active, consent_at)
          VALUES (?, 1, CURRENT_TIMESTAMP)`).run(email);
      }
      return 'subscribed';
    }).immediate();
    if (outcome === 'duplicate') return res.status(409).json({ error: 'This email is already subscribed.' });
    res.status(201).json({ message: 'You are subscribed to Bounce Bash updates.' });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'This email is already subscribed.' });
    next(error);
  }
});

app.post('/api/newsletter/unsubscribe/request', tokenLimiter, (req, res) => {
  const parsed = z.object({ email: z.email().trim().max(254) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email address.' });
  const subscription = db.prepare(`SELECT id, email FROM newsletter_subscriptions
    WHERE email = ? COLLATE NOCASE AND active = 1`).get(parsed.data.email);
  let token;
  if (subscription) {
    token = issueNewsletterToken(subscription.id);
    const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
    const link = `${baseUrl.replace(/\/$/, '')}/unsubscribe.html?token=${encodeURIComponent(token)}`;
    sendEmail({
      to: subscription.email,
      subject: 'Unsubscribe from Bounce Bash updates',
      text: `Use this link within 60 minutes to unsubscribe:\n\n${link}`
    }).catch(error => {
      if (error.code !== 'EMAIL_NOT_CONFIGURED') console.error('Newsletter unsubscribe delivery failed:', error.code || 'DELIVERY_FAILED');
    });
  }
  res.json({
    message: 'If that address is subscribed, an unsubscribe link will be sent.',
    ...(token && devTokenAllowed() ? { unsubscribeToken: token } : {})
  });
});

app.post('/api/newsletter/unsubscribe', tokenLimiter, (req, res) => {
  const parsed = z.object({ token: z.string().min(32).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'The unsubscribe link is invalid or has expired.' });
  const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
  const result = db.transaction(() => {
    const token = db.prepare(`SELECT id, subscription_id FROM newsletter_tokens
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`).get(tokenHash, Date.now());
    if (!token) return false;
    db.prepare('UPDATE newsletter_subscriptions SET active = 0 WHERE id = ?').run(token.subscription_id);
    db.prepare('UPDATE newsletter_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL').run(Date.now(), token.id);
    return true;
  }).immediate();
  if (!result) return res.status(400).json({ error: 'The unsubscribe link is invalid or has expired.' });
  res.json({ message: 'You have been unsubscribed from Bounce Bash updates.' });
});

app.post('/api/feedback', authLimiter, (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(2).max(100),
    eventType: z.enum(['Birthday party', 'Christening', 'School event', 'Barangay festival', 'Resort event', 'Baby shower']),
    packageId: z.string().min(1).max(80),
    rating: z.number().int().min(1).max(5),
    message: z.string().trim().min(10).max(2000),
    publishConsent: z.boolean().default(false)
  });
  const input = validate(schema, req, res);
  if (!input) return;
  const packageExists = db.prepare('SELECT id FROM packages WHERE id = ? AND active = 1').get(input.packageId);
  if (!packageExists) return res.status(400).json({ error: 'Choose a valid package.' });
  const result = db.prepare(`INSERT INTO customer_feedback (name, event_type, package_id, rating, message, publish_consent)
    VALUES (?, ?, ?, ?, ?, ?)`).run(input.name, input.eventType, input.packageId, input.rating, input.message, input.publishConsent ? 1 : 0);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Thank you. Your feedback has been received for review.' });
});

app.get('/api/availability', (req, res) => {
  const query = z.object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .refine(value => Number(value.slice(0, 4)) >= 1000)
  }).safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: 'month must use YYYY-MM format.' });
  const start = `${query.data.month}-01`;
  const [year, month] = query.data.month.split('-').map(Number);
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const bookings = db.prepare(`SELECT model_id AS modelId, event_date AS eventDate, status FROM bookings
    WHERE event_date BETWEEN ? AND ? AND status IN ('pending', 'confirmed')`).all(start, end);
  res.json({ month: query.data.month, bookings });
});

app.post('/api/bookings', requireCustomer, bookingLimiter, (req, res, next) => {
  const input = validate(bookingSchema, req, res);
  if (!input) return;
  const customer = db.prepare('SELECT email_verified FROM customers WHERE id = ?').get(req.session.customerId);
  if (!customer?.email_verified) return res.status(403).json({ error: 'Verify your email address before submitting a booking request.' });
  const idempotencyKey = req.get('idempotency-key');
  if (!idempotencyKey || !/^[a-zA-Z0-9-]{16,80}$/.test(idempotencyKey)) {
    return res.status(400).json({ error: 'A valid idempotency key is required. Please try submitting again.' });
  }
  if (input.eventDate < todayInManila()) return res.status(400).json({ error: 'Event date must be today or later.' });

  const existing = db.prepare(`${bookingSelect} WHERE b.customer_id = ? AND b.idempotency_key = ?`).get(req.session.customerId, idempotencyKey);
  if (existing) return res.status(200).json({ booking: bookingView(existing), repeated: true });
  const packageRow = db.prepare('SELECT id, name, price_cents FROM packages WHERE id = ? AND active = 1').get(input.packageId);
  const modelRow = db.prepare('SELECT id, name, capacity FROM inflatable_models WHERE id = ? AND active = 1').get(input.modelId);
  if (!packageRow || !modelRow) return res.status(400).json({ error: 'Choose a valid package and inflatable style.' });
  if (input.childrenCount > modelRow.capacity) return res.status(400).json({ error: `This style accommodates up to ${modelRow.capacity} children.` });
  const addonRows = input.addonIds.length ? db.prepare(`SELECT id, name, price_cents FROM addons WHERE active = 1 AND id IN (${input.addonIds.map(() => '?').join(',')})`).all(...new Set(input.addonIds)) : [];
  if (addonRows.length !== new Set(input.addonIds).size) return res.status(400).json({ error: 'One or more selected add-ons are not available.' });

  const createBooking = db.transaction(() => {
    const totalCents = packageRow.price_cents + addonRows.reduce((total, addon) => total + addon.price_cents, 0);
    const insert = db.prepare(`INSERT INTO bookings
      (customer_id, package_id, model_id, event_date, event_time, venue, children_count, notes, total_cents, idempotency_key,
       package_name_snapshot, package_price_cents_snapshot, model_name_snapshot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const result = insert.run(req.session.customerId, input.packageId, input.modelId, input.eventDate, input.eventTime,
      input.venue, input.childrenCount, input.notes, totalCents, idempotencyKey, packageRow.name, packageRow.price_cents, modelRow.name);
    const linkAddon = db.prepare(`INSERT INTO booking_addons
      (booking_id, addon_id, name_snapshot, price_cents_snapshot) VALUES (?, ?, ?, ?)`);
    addonRows.forEach(addon => linkAddon.run(result.lastInsertRowid, addon.id, addon.name, addon.price_cents));
    db.prepare(`INSERT INTO booking_events (booking_id, actor_type, actor_id, previous_status, new_status, note)
      VALUES (?, 'customer', ?, NULL, 'pending', 'Booking request submitted')`).run(result.lastInsertRowid, req.session.customerId);
    const customer = db.prepare('SELECT email, name FROM customers WHERE id = ?').get(req.session.customerId);
    if (customer) enqueueEmail(db, {
      to: customer.email,
      subject: `Bounce Bash booking request #${result.lastInsertRowid} received`,
      text: `Hello ${customer.name}, your booking request for ${input.eventDate} has been received and is pending review.`
    });
    return result.lastInsertRowid;
  });

  try {
    const bookingId = createBooking.immediate();
    const row = db.prepare(`${bookingSelect} WHERE b.id = ? AND b.customer_id = ?`).get(bookingId, req.session.customerId);
    res.status(201).json({ booking: bookingView(row) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const repeated = db.prepare(`${bookingSelect} WHERE b.customer_id = ? AND b.idempotency_key = ?`)
        .get(req.session.customerId, idempotencyKey);
      if (repeated) return res.status(200).json({ booking: bookingView(repeated), repeated: true });
      return res.status(409).json({ error: 'That inflatable is already requested or booked for this date. Choose another style or date.' });
    }
    if (error.code === 'SQLITE_CONSTRAINT_CHECK' || error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return res.status(400).json({ error: 'The booking details are not valid.' });
    }
    next(error);
  }
});

app.get('/api/bookings', requireCustomer, (req, res) => {
  const rows = db.prepare(`${bookingSelect} WHERE b.customer_id = ? ORDER BY b.event_date DESC, b.id DESC`).all(req.session.customerId);
  res.json({ bookings: rows.map(bookingView) });
});

app.get('/api/bookings/:id', requireCustomer, (req, res) => {
  const row = db.prepare(`${bookingSelect} WHERE b.id = ? AND b.customer_id = ?`).get(Number(req.params.id), req.session.customerId);
  if (!row) return res.status(404).json({ error: 'Booking not found.' });
  res.json({ booking: bookingView(row) });
});

app.post('/api/bookings/:id/cancel', requireCustomer, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(404).json({ error: 'Booking not found.' });
  const result = db.transaction(() => {
    const booking = db.prepare(`SELECT id, status FROM bookings WHERE id = ? AND customer_id = ?
      AND event_date >= ?`).get(id, req.session.customerId, todayInManila());
    if (booking?.status === 'cancelled') {
      const lastEvent = db.prepare(`SELECT actor_type, actor_id, note FROM booking_events
        WHERE booking_id = ? ORDER BY id DESC LIMIT 1`).get(id);
      if (lastEvent?.actor_type === 'customer' && lastEvent.actor_id === req.session.customerId && lastEvent.note === 'Cancelled by customer') {
        return { repeated: true };
      }
      return { conflict: true };
    }
    if (!booking) {
      const ownerBooking = db.prepare('SELECT id, status FROM bookings WHERE id = ? AND customer_id = ?')
        .get(id, req.session.customerId);
      if (!ownerBooking) return { missing: true };
      if (ownerBooking.status === 'cancelled') return { conflict: true };
      return { conflict: true };
    }
    if (booking.status !== 'pending') return { conflict: true };
    db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ? AND status = 'pending'`).run(id);
    db.prepare(`INSERT INTO booking_events (booking_id, actor_type, actor_id, previous_status, new_status, note)
      VALUES (?, 'customer', ?, 'pending', 'cancelled', 'Cancelled by customer')`).run(id, req.session.customerId);
    return {};
  }).immediate();
  if (result.missing) return res.status(404).json({ error: 'Booking not found.' });
  if (result.conflict) return res.status(409).json({ error: 'Only upcoming pending bookings can be cancelled online.' });
  const row = db.prepare(`${bookingSelect} WHERE b.id = ? AND b.customer_id = ?`).get(id, req.session.customerId);
  if (!row) return res.status(404).json({ error: 'Booking not found.' });
  res.json({ booking: bookingView(row), ...(result.repeated ? { repeated: true } : {}) });
});

registerStaffRoutes(app, db, { authLimiter, bookingSelect, bookingView, enqueueEmail });

app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.use((req, res, next) => {
  if (/^\/(server|data|node_modules)(\/|$)/.test(req.path) || /^\/(\.env|package(?:-lock)?\.json)$/.test(req.path)) {
    return res.status(404).end();
  }
  next();
});
app.use('/assets', express.static(path.resolve(__dirname, '..', '..', 'assets')));
app.use(express.static(path.resolve(__dirname, '..'), { index: 'index.html' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.status === 400 && error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must contain valid JSON.' });
  }
  res.status(500).json({ error: 'Something went wrong. Please try again later.' });
});

if (require.main === module) {
  if (isConfigured() && process.env.NODE_ENV !== 'test') {
    const worker = setInterval(() => {
      deliverOutbox(db).catch(error => console.error('Email outbox worker failed:', error.code || 'DELIVERY_FAILED'));
    }, 10000);
    worker.unref();
  }
  app.listen(port, () => console.log(`Bounce Bash Customer Side listening on http://localhost:${port}`));
}

module.exports = { app, db };