const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncebash-test-'));
const databasePath = path.join(tempDirectory, 'test.sqlite');
process.env.DATABASE_PATH = databasePath;
process.env.NODE_ENV = 'test';

const { app, db } = require('../server/app');
const { createDatabase } = require('../server/database');
const { processOutbox } = require('../server/email');
const { createInitialStaffAccount } = require('../server/create-staff');
const { createPaymentProvider, paymentProviderNotConfigured } = require('../server/payment-provider');
let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  db.close();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

async function request(url, { cookie, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set('Cookie', cookie);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${baseUrl}${url}`, { ...options, headers });
  const setCookie = response.headers.getSetCookie?.()[0]?.split(';')[0];
  const contentType = response.headers.get('content-type') || '';
  const body = response.status === 204 ? null : contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, body, cookie: setCookie || cookie };
}

async function register(email, name = 'Test Customer') {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, contact: '+639171234567', password: 'A-strong-password-2026' })
  });
}

function createLegacyDatabase(databaseFile) {
  const legacy = new (require('better-sqlite3'))(databaseFile);
  legacy.pragma('foreign_keys = ON');
  legacy.exec(`
    CREATE TABLE customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      contact TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE packages (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL,
      price_cents INTEGER NOT NULL CHECK (price_cents >= 0), active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE inflatable_models (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL,
      capacity INTEGER NOT NULL CHECK (capacity > 0), active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE addons (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
      price_cents INTEGER NOT NULL CHECK (price_cents >= 0), active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id),
      package_id TEXT NOT NULL REFERENCES packages(id), model_id TEXT NOT NULL REFERENCES inflatable_models(id),
      event_date TEXT NOT NULL, event_time TEXT NOT NULL, venue TEXT NOT NULL,
      children_count INTEGER NOT NULL CHECK (children_count BETWEEN 1 AND 1000), notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
      total_cents INTEGER NOT NULL CHECK (total_cents >= 0), idempotency_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (customer_id, idempotency_key));
    CREATE UNIQUE INDEX one_active_booking_per_model_date ON bookings(model_id, event_date) WHERE status IN ('pending', 'confirmed');
    CREATE INDEX bookings_customer_date ON bookings(customer_id, event_date);
    CREATE TABLE booking_addons (booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      addon_id TEXT NOT NULL REFERENCES addons(id), PRIMARY KEY (booking_id, addon_id));
    CREATE TABLE web_sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE INDEX web_sessions_expiry ON web_sessions(expires_at);
    CREATE TABLE newsletter_subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE, subscribed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE customer_feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, event_type TEXT NOT NULL,
      package_id TEXT NOT NULL REFERENCES packages(id), rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      message TEXT NOT NULL, publish_consent INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  `);
  legacy.exec(`
    INSERT INTO customers (name,email,contact,password_hash) VALUES ('Legacy Customer','legacy@example.test','+639171234567','legacy-hash');
    INSERT INTO packages VALUES ('legacy-package','Legacy package','Existing description',123456,1);
    INSERT INTO inflatable_models VALUES ('legacy-model','Legacy model','Existing model',8,1);
    INSERT INTO addons VALUES ('legacy-addon','Legacy addon',500,1);
    INSERT INTO bookings (customer_id,package_id,model_id,event_date,event_time,venue,children_count,total_cents,idempotency_key)
      VALUES (1,'legacy-package','legacy-model','2099-01-02','12:00','Legacy venue',4,123956,'legacy-idempotency-key');
    INSERT INTO booking_addons VALUES (1,'legacy-addon');
    INSERT INTO web_sessions VALUES ('legacy-sid','{"customerId":1}',9999999999999);
    INSERT INTO newsletter_subscriptions (email) VALUES ('legacy-news@example.test');
    INSERT INTO customer_feedback (name,event_type,package_id,rating,message) VALUES ('Legacy Name','Birthday party','legacy-package',5,'Legacy feedback message');
  `);
  legacy.close();
}

test('customer, booking, staff operations, newsletter, and account security', async () => {
  const health = await request('/api/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.body.status, 'ok');
  assert.equal((await request('/api/newsletter', {
    method: 'POST',
    headers: { Origin: 'https://untrusted.example' },
    body: JSON.stringify({ email: 'blocked@example.test', consent: true })
  })).response.status, 403);

  for (const month of ['2099-00', '2099-13', '0000-01', 'bad']) {
    assert.equal((await request(`/api/availability?month=${month}`)).response.status, 400);
  }
  assert.equal((await request('/api/availability?month=2099-06')).response.status, 200);

  for (const privatePath of ['/data/test.sqlite', '/server/app.js', '/.env', '/package.json']) {
    assert.equal((await request(privatePath)).response.status, 404, `${privatePath} should not be publicly served`);
  }

  const catalog = await request('/api/catalog');
  assert.equal(catalog.response.status, 200);
  assert.equal(catalog.body.packages.length, 4);
  assert.ok(catalog.body.models.some(model => model.id === 'classic-white-castle'));

  const noConsent = await request('/api/newsletter', {
    method: 'POST', body: JSON.stringify({ email: 'updates@example.test' })
  });
  assert.equal(noConsent.response.status, 400);
  const subscription = await request('/api/newsletter', {
    method: 'POST', body: JSON.stringify({ email: 'updates@example.test', consent: true })
  });
  assert.equal(subscription.response.status, 201);
  const duplicateSubscription = await request('/api/newsletter', {
    method: 'POST', body: JSON.stringify({ email: 'UPDATES@example.test', consent: true })
  });
  assert.equal(duplicateSubscription.response.status, 409);

  const unsubscribeRequest = await request('/api/newsletter/unsubscribe/request', {
    method: 'POST', body: JSON.stringify({ email: 'updates@example.test' })
  });
  assert.equal(unsubscribeRequest.response.status, 200);
  const unsubscribeHash = crypto.createHash('sha256').update(unsubscribeRequest.body.unsubscribeToken).digest('hex');
  assert.equal(db.prepare('SELECT token_hash FROM newsletter_tokens WHERE token_hash = ?').get(unsubscribeHash).token_hash, unsubscribeHash);
  const unsubscribe = await request('/api/newsletter/unsubscribe', {
    method: 'POST', body: JSON.stringify({ token: unsubscribeRequest.body.unsubscribeToken })
  });
  assert.equal(unsubscribe.response.status, 200);
  assert.equal(db.prepare('SELECT active FROM newsletter_subscriptions WHERE email = ?').get('updates@example.test').active, 0);
  assert.equal((await request('/api/newsletter/unsubscribe', {
    method: 'POST', body: JSON.stringify({ token: unsubscribeRequest.body.unsubscribeToken })
  })).response.status, 400);
  assert.equal((await request('/api/newsletter', {
    method: 'POST', body: JSON.stringify({ email: 'updates@example.test' })
  })).response.status, 400);
  assert.equal((await request('/api/newsletter', {
    method: 'POST', body: JSON.stringify({ email: 'updates@example.test', consent: true })
  })).response.status, 201);

  const feedback = await request('/api/feedback', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Feedback Customer', eventType: 'Birthday party', packageId: 'little-bounce', rating: 5,
      message: 'The setup was wonderful and the kids loved it.', publishConsent: false
    })
  });
  assert.equal(feedback.response.status, 201);
  assert.equal(db.prepare('SELECT status FROM customer_feedback WHERE id = ?').get(feedback.body.id).status, 'pending');

  assert.equal((await request('/api/bookings')).response.status, 401);
  assert.equal((await request('/api/staff/bookings')).response.status, 401);

  const badRegister = await request('/api/auth/register', {
    method: 'POST', body: JSON.stringify({ email: 'bad', password: 'short' })
  });
  assert.equal(badRegister.response.status, 400);
  const overlongUtf8Password = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Unicode Customer', email: 'unicode@example.test', contact: '+639171234567', password: 'é'.repeat(40) })
  });
  assert.equal(overlongUtf8Password.response.status, 400);
  const first = await register('first@example.test', 'First Customer');
  assert.equal(first.response.status, 201);
  assert.equal(first.body.customer.name, 'First Customer');
  assert.equal(first.body.customer.emailVerified, false);
  const verificationHash = crypto.createHash('sha256').update(first.body.verificationToken).digest('hex');
  assert.equal(db.prepare('SELECT token_hash FROM customer_tokens WHERE token_hash = ?').get(verificationHash).token_hash, verificationHash);
  const unverifiedBooking = await request('/api/bookings', {
    method: 'POST', cookie: first.cookie, headers: { 'Idempotency-Key': 'unverified-booking-0001' },
    body: JSON.stringify({
      packageId: 'little-bounce', modelId: 'classic-white-castle', eventDate: '2099-06-13',
      eventTime: '14:00', venue: '123 Sample Street, Manila', childrenCount: 8, notes: '', addonIds: []
    })
  });
  assert.equal(unverifiedBooking.response.status, 403);
  const verification = await request('/api/auth/email/verification/confirm', {
    method: 'POST', body: JSON.stringify({ token: first.body.verificationToken })
  });
  assert.equal(verification.response.status, 200);
  assert.equal((await request('/api/auth/email/verification/confirm', {
    method: 'POST', body: JSON.stringify({ token: first.body.verificationToken })
  })).response.status, 400);
  const duplicate = await register('first@example.test');
  assert.equal(duplicate.response.status, 409);

  const customerStaffDenied = await request('/api/staff/bookings', { cookie: first.cookie });
  assert.equal(customerStaffDenied.response.status, 401);

  const badLogin = await request('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email: 'first@example.test', password: 'not-the-password' })
  });
  assert.equal(badLogin.response.status, 401);
  const login = await request('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email: 'first@example.test', password: 'A-strong-password-2026' })
  });
  assert.equal(login.response.status, 200);
  assert.ok(login.cookie);
  const me = await request('/api/auth/me', { cookie: login.cookie });
  assert.equal(me.body.customer.email, 'first@example.test');
  assert.equal(me.body.customer.emailVerified, true);
  const profile = await request('/api/customer/profile', {
    method: 'PATCH', cookie: login.cookie, body: JSON.stringify({ name: 'Updated Customer', contact: '+639179999999' })
  });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.body.customer.name, 'Updated Customer');

  const invalidBooking = await request('/api/bookings', {
    method: 'POST', cookie: login.cookie, headers: { 'Idempotency-Key': 'invalid-key-123456' }, body: JSON.stringify({})
  });
  assert.equal(invalidBooking.response.status, 400);

  const eventDate = '2099-06-14';
  const bookingInput = {
    packageId: 'little-bounce', modelId: 'classic-white-castle', eventDate,
    eventTime: '14:00', venue: '123 Sample Street, Manila', childrenCount: 8,
    notes: 'Test booking', addonIds: ['balloon-garland']
  };
  const firstKey = 'test-booking-key-0000001';
  const created = await request('/api/bookings', {
    method: 'POST', cookie: login.cookie, headers: { 'Idempotency-Key': firstKey }, body: JSON.stringify(bookingInput)
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.booking.status, 'pending');
  assert.equal(created.body.booking.totalCents, 700000);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM booking_events WHERE booking_id = ?').get(created.body.booking.id).count, 1);

  const repeated = await request('/api/bookings', {
    method: 'POST', cookie: login.cookie, headers: { 'Idempotency-Key': firstKey }, body: JSON.stringify(bookingInput)
  });
  assert.equal(repeated.response.status, 200);
  assert.equal(repeated.body.booking.id, created.body.booking.id);
  assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM email_outbox
    WHERE recipient = 'first@example.test' AND subject LIKE 'Bounce Bash booking request%'`).get().count, 1);

  const conflict = await request('/api/bookings', {
    method: 'POST', cookie: login.cookie, headers: { 'Idempotency-Key': 'test-booking-key-0000002' }, body: JSON.stringify(bookingInput)
  });
  assert.equal(conflict.response.status, 409);

  const invalidCalendarDate = await request('/api/bookings', {
    method: 'POST', cookie: login.cookie, headers: { 'Idempotency-Key': 'test-booking-key-0000003' },
    body: JSON.stringify({ ...bookingInput, eventDate: '2099-02-31' })
  });
  assert.equal(invalidCalendarDate.response.status, 400);
  const unavailableForChildren = await request('/api/bookings', {
    method: 'POST', cookie: login.cookie, headers: { 'Idempotency-Key': 'test-booking-key-0000004' },
    body: JSON.stringify({ ...bookingInput, modelId: 'classic-white-castle', eventDate: '2099-06-15', childrenCount: 11 })
  });
  assert.equal(unavailableForChildren.response.status, 400);

  const concurrentInput = { ...bookingInput, eventDate: '2099-06-16' };
  const concurrent = await Promise.all(['test-booking-key-0000005', 'test-booking-key-0000006'].map(key =>
    request('/api/bookings', {
      method: 'POST', cookie: login.cookie, headers: { 'Idempotency-Key': key }, body: JSON.stringify(concurrentInput)
    })
  ));
  assert.deepEqual(concurrent.map(item => item.response.status).sort(), [201, 409]);
  const concurrentWinner = concurrent.find(item => item.response.status === 201);
  const repeatedConcurrent = await Promise.all([1, 2].map(() =>
    request('/api/bookings', {
      method: 'POST', cookie: login.cookie, headers: { 'Idempotency-Key': 'test-booking-key-0000009' },
      body: JSON.stringify({ ...bookingInput, eventDate: '2099-06-18' })
    })
  ));
  assert.deepEqual(repeatedConcurrent.map(item => item.response.status).sort(), [200, 201]);
  assert.equal(repeatedConcurrent[0].body.booking.id, repeatedConcurrent[1].body.booking.id);

  const createdStaff = await createInitialStaffAccount(db, {
    name: 'Initial Admin', email: 'admin@example.test', password: 'Staff-strong-password-2026'
  });
  assert.equal(createdStaff, 'admin@example.test');
  await assert.rejects(() => createInitialStaffAccount(db, {
    name: 'Second Admin', email: 'second-admin@example.test', password: 'Staff-strong-password-2026'
  }), /only available before the first staff account exists/);
  const plainStaff = db.prepare('SELECT password_hash FROM staff_users WHERE email = ?').get('admin@example.test');
  assert.notEqual(plainStaff.password_hash, 'Staff-strong-password-2026');
  assert.equal(await bcrypt.compare('Staff-strong-password-2026', plainStaff.password_hash), true);

  const adminLogin = await request('/api/staff/auth/login', {
    method: 'POST', body: JSON.stringify({ email: 'admin@example.test', password: 'Staff-strong-password-2026' })
  });
  assert.equal(adminLogin.response.status, 200);
  const staffBookingList = await request('/api/staff/bookings?status=pending&q=first%40example.test', { cookie: adminLogin.cookie });
  assert.equal(staffBookingList.response.status, 200);
  assert.ok(staffBookingList.body.bookings.some(item => item.id === created.body.booking.id));
  const staffBooking = await request(`/api/staff/bookings/${created.body.booking.id}`, { cookie: adminLogin.cookie });
  assert.equal(staffBooking.body.booking.customer.email, 'first@example.test');
  const confirmed = await request(`/api/staff/bookings/${created.body.booking.id}/status`, {
    method: 'PATCH', cookie: adminLogin.cookie, body: JSON.stringify({ status: 'confirmed', note: 'Checked and confirmed.' })
  });
  assert.equal(confirmed.response.status, 200);
  assert.equal(confirmed.body.booking.status, 'confirmed');
  assert.equal((await request(`/api/staff/bookings/${created.body.booking.id}/status`, {
    method: 'PATCH', cookie: adminLogin.cookie, body: JSON.stringify({ status: 'confirmed' })
  })).response.status, 409);
  const completed = await request(`/api/staff/bookings/${created.body.booking.id}/status`, {
    method: 'PATCH', cookie: adminLogin.cookie, body: JSON.stringify({ status: 'completed' })
  });
  assert.equal(completed.response.status, 200);
  assert.equal(completed.body.booking.status, 'completed');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM booking_events WHERE booking_id = ?').get(created.body.booking.id).count, 3);

  const rejected = await request(`/api/staff/bookings/${concurrentWinner.body.booking.id}/status`, {
    method: 'PATCH', cookie: adminLogin.cookie, body: JSON.stringify({ status: 'rejected', note: 'Unavailable.' })
  });
  assert.equal(rejected.response.status, 200);
  assert.equal(rejected.body.booking.status, 'rejected');
  assert.equal((await request(`/api/staff/bookings/${concurrentWinner.body.booking.id}/status`, {
    method: 'PATCH', cookie: adminLogin.cookie, body: JSON.stringify({ status: 'confirmed' })
  })).response.status, 409);

  const addedStaff = await request('/api/staff/users', {
    method: 'POST', cookie: adminLogin.cookie,
    body: JSON.stringify({ name: 'Booking Manager', email: 'manager@example.test', password: 'Manager-strong-password-2026', role: 'manager' })
  });
  assert.equal(addedStaff.response.status, 201);
  const managerLogin = await request('/api/staff/auth/login', {
    method: 'POST', body: JSON.stringify({ email: 'manager@example.test', password: 'Manager-strong-password-2026' })
  });
  assert.equal(managerLogin.response.status, 200);
  assert.equal((await request('/api/staff/catalog', { cookie: managerLogin.cookie })).response.status, 403);
  assert.equal((await request('/api/staff/bookings', { cookie: managerLogin.cookie })).response.status, 200);
  const staffPasswordChange = await request('/api/staff/auth/password', {
    method: 'POST', cookie: managerLogin.cookie,
    body: JSON.stringify({ currentPassword: 'Manager-strong-password-2026', newPassword: 'Manager-new-password-2026' })
  });
  assert.equal(staffPasswordChange.response.status, 200);
  assert.equal((await request('/api/staff/bookings', { cookie: managerLogin.cookie })).response.status, 401);

  const staffCancelledBooking = await request('/api/bookings', {
    method: 'POST', cookie: login.cookie, headers: { 'Idempotency-Key': 'test-booking-key-0000008' },
    body: JSON.stringify({ ...bookingInput, eventDate: '2099-06-17' })
  });
  assert.equal(staffCancelledBooking.response.status, 201);
  assert.equal((await request(`/api/staff/bookings/${staffCancelledBooking.body.booking.id}/status`, {
    method: 'PATCH', cookie: adminLogin.cookie, body: JSON.stringify({ status: 'confirmed' })
  })).response.status, 200);
  const staffCancelled = await request(`/api/staff/bookings/${staffCancelledBooking.body.booking.id}/status`, {
    method: 'PATCH', cookie: adminLogin.cookie, body: JSON.stringify({ status: 'cancelled', note: 'Customer request by phone.' })
  });
  assert.equal(staffCancelled.response.status, 200);
  assert.equal(staffCancelled.body.booking.status, 'cancelled');

  const catalogUpdate = await request('/api/staff/catalog/packages/little-bounce', {
    method: 'PATCH', cookie: adminLogin.cookie, body: JSON.stringify({ priceCents: -1 })
  });
  assert.equal(catalogUpdate.response.status, 400);
  const validCatalogUpdate = await request('/api/staff/catalog/packages/little-bounce', {
    method: 'PATCH', cookie: adminLogin.cookie, body: JSON.stringify({ priceCents: 470000 })
  });
  assert.equal(validCatalogUpdate.response.status, 200);
  assert.equal(validCatalogUpdate.body.item.priceCents, 470000);
  const historicalBooking = await request(`/api/bookings/${created.body.booking.id}`, { cookie: login.cookie });
  assert.equal(historicalBooking.body.booking.package.priceCents, 450000);
  assert.equal(historicalBooking.body.booking.addons[0].priceCents, 250000);
  assert.equal((await request(`/api/staff/feedback/${feedback.body.id}`, {
    method: 'PATCH', cookie: adminLogin.cookie, body: JSON.stringify({ status: 'approved' })
  })).response.status, 200);
  assert.equal((await request(`/api/staff/feedback/${feedback.body.id}`, {
    method: 'PATCH', cookie: adminLogin.cookie, body: JSON.stringify({ status: 'resolved' })
  })).body.feedback.status, 'resolved');
  const exportedNewsletter = await request('/api/staff/newsletter?format=csv', { cookie: adminLogin.cookie });
  assert.equal(exportedNewsletter.response.status, 200);
  assert.match(exportedNewsletter.body, /updates@example\.test/);

  const releasedDate = await request('/api/bookings', {
    method: 'POST', cookie: login.cookie, headers: { 'Idempotency-Key': 'test-booking-key-0000007' }, body: JSON.stringify(bookingInput)
  });
  assert.equal(releasedDate.response.status, 201);
  const cancelled = await request(`/api/bookings/${releasedDate.body.booking.id}/cancel`, {
    method: 'POST', cookie: login.cookie
  });
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.body.booking.status, 'cancelled');
  const repeatedCancellation = await request(`/api/bookings/${releasedDate.body.booking.id}/cancel`, {
    method: 'POST', cookie: login.cookie
  });
  assert.equal(repeatedCancellation.response.status, 200);
  assert.equal(repeatedCancellation.body.repeated, true);

  const history = await request('/api/bookings', { cookie: login.cookie });
  assert.equal(history.response.status, 200);
  assert.equal(history.body.bookings.length, 5);
  const hiddenBooking = await request(`/api/bookings/${created.body.booking.id}`, { cookie: managerLogin.cookie });
  assert.equal(hiddenBooking.response.status, 401);

  const passwordChanged = await request('/api/customer/password', {
    method: 'POST', cookie: login.cookie,
    body: JSON.stringify({ currentPassword: 'A-strong-password-2026', newPassword: 'A-different-password-2026' })
  });
  assert.equal(passwordChanged.response.status, 200);
  assert.equal((await request('/api/bookings', { cookie: login.cookie })).response.status, 401);
  const resetRequest = await request('/api/auth/password-reset', {
    method: 'POST', body: JSON.stringify({ email: 'first@example.test' })
  });
  const unknownReset = await request('/api/auth/password-reset', {
    method: 'POST', body: JSON.stringify({ email: 'unknown@example.test' })
  });
  assert.equal(resetRequest.body.message, unknownReset.body.message);
  assert.ok(resetRequest.body.resetToken);
  const resetConfirm = await request('/api/auth/password-reset/confirm', {
    method: 'POST', body: JSON.stringify({ token: resetRequest.body.resetToken, password: 'Reset-password-2026' })
  });
  assert.equal(resetConfirm.response.status, 200);
  assert.equal((await request('/api/auth/password-reset/confirm', {
    method: 'POST', body: JSON.stringify({ token: resetRequest.body.resetToken, password: 'Reset-password-2026' })
  })).response.status, 400);
  const resetLogin = await request('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email: 'first@example.test', password: 'Reset-password-2026' })
  });
  assert.equal(resetLogin.response.status, 200);
  const expiredRequest = await request('/api/auth/password-reset', {
    method: 'POST', body: JSON.stringify({ email: 'first@example.test' })
  });
  const expiredHash = crypto.createHash('sha256').update(expiredRequest.body.resetToken).digest('hex');
  db.prepare('UPDATE customer_tokens SET expires_at = 0 WHERE token_hash = ?').run(expiredHash);
  assert.equal((await request('/api/auth/password-reset/confirm', {
    method: 'POST', body: JSON.stringify({ token: expiredRequest.body.resetToken, password: 'Reset-password-2026' })
  })).response.status, 400);

  const emailChange = await request('/api/customer/email-change', {
    method: 'POST', cookie: resetLogin.cookie,
    body: JSON.stringify({ email: 'updated@example.test', password: 'Reset-password-2026' })
  });
  assert.equal(emailChange.response.status, 200);
  const emailConfirm = await request('/api/customer/email-change/confirm', {
    method: 'POST', body: JSON.stringify({ token: emailChange.body.verificationToken })
  });
  assert.equal(emailConfirm.response.status, 200);
  const updatedLogin = await request('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email: 'updated@example.test', password: 'Reset-password-2026' })
  });
  assert.equal(updatedLogin.response.status, 200);

  const deactivate = await request('/api/customer/deactivate', {
    method: 'POST', cookie: updatedLogin.cookie,
    body: JSON.stringify({ password: 'Reset-password-2026', confirm: true })
  });
  assert.equal(deactivate.response.status, 200);
  assert.equal((await request('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email: 'updated@example.test', password: 'Reset-password-2026' })
  })).response.status, 401);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM bookings WHERE customer_id = 1').get().count, 5);

  const logout = await request('/api/staff/auth/logout', { method: 'POST', cookie: adminLogin.cookie });
  assert.equal(logout.response.status, 204);
  assert.equal((await request('/api/staff/bookings', { cookie: adminLogin.cookie })).response.status, 401);
});

test('legacy database migration preserves customer and operational data', () => {
  const legacyPath = path.join(tempDirectory, 'legacy.sqlite');
  createLegacyDatabase(legacyPath);
  const migrated = createDatabase(legacyPath);
  assert.equal(migrated.prepare('SELECT name FROM customers WHERE id = 1').get().name, 'Legacy Customer');
  assert.equal(migrated.prepare('SELECT status, total_cents FROM bookings WHERE id = 1').get().status, 'pending');
  assert.equal(migrated.prepare('SELECT COUNT(*) AS count FROM booking_addons WHERE booking_id = 1').get().count, 1);
  assert.equal(migrated.prepare('SELECT sess FROM web_sessions WHERE sid = ?').get('legacy-sid').sess, '{"customerId":1}');
  assert.equal(migrated.prepare('SELECT email FROM newsletter_subscriptions WHERE id = 1').get().email, 'legacy-news@example.test');
  assert.equal(migrated.prepare('SELECT message FROM customer_feedback WHERE id = 1').get().message, 'Legacy feedback message');
  assert.equal(migrated.prepare('SELECT package_name_snapshot, package_price_cents_snapshot FROM bookings WHERE id = 1').get().package_price_cents_snapshot, 123456);
  assert.equal(migrated.prepare('SELECT name_snapshot, price_cents_snapshot FROM booking_addons WHERE booking_id = 1').get().name_snapshot, 'Legacy addon');
  assert.deepEqual(migrated.pragma('foreign_key_check'), []);
  assert.deepEqual(migrated.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(row => row.version), [1, 2, 3, 4]);
  migrated.prepare("UPDATE bookings SET status = 'rejected' WHERE id = 1").run();
  migrated.prepare("UPDATE bookings SET status = 'completed' WHERE id = 1").run();
  migrated.close();
  const reopened = createDatabase(legacyPath);
  assert.equal(reopened.prepare('SELECT COUNT(*) AS count FROM customers').get().count, 1);
  assert.deepEqual(reopened.pragma('foreign_key_check'), []);
  reopened.close();
});

test('production rejects a weak session secret before opening the database', () => {
  const unopenedPath = path.join(tempDirectory, 'must-not-open.sqlite');
  const environment = { ...process.env, NODE_ENV: 'production', SESSION_SECRET: 'too-short', DATABASE_PATH: unopenedPath };
  for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'PUBLIC_BASE_URL']) delete environment[key];
  const result = spawnSync(process.execPath, ['-e', "require('./server/app')"], {
    cwd: path.resolve(__dirname, '..'),
    env: environment,
    encoding: 'utf8'
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SESSION_SECRET must contain at least 32 characters/);
  assert.equal(fs.existsSync(unopenedPath), false);
});

test('email outbox records failures and schedules a retry without exposing message content', async () => {
  const retryPath = path.join(tempDirectory, 'outbox.sqlite');
  const retryDb = createDatabase(retryPath);
  const { enqueueEmail } = require('../server/email');
  enqueueEmail(retryDb, { to: 'recipient@example.test', subject: 'Subject', text: 'Notification body' });
  await processOutbox(retryDb, async () => {
    const error = new Error('Private SMTP response');
    error.code = 'SMTP_TEMPORARY';
    throw error;
  });
  const record = retryDb.prepare('SELECT status, attempts, last_error, next_attempt_at, text_body FROM email_outbox').get();
  assert.equal(record.status, 'failed');
  assert.equal(record.attempts, 1);
  assert.equal(record.last_error, 'SMTP_TEMPORARY');
  assert.ok(record.next_attempt_at > Date.now());
  assert.equal(record.text_body, 'Notification body');
  retryDb.close();
});

test('payment processing fails closed until an explicit provider adapter is supplied', async () => {
  assert.throws(() => createPaymentProvider(null), /must implement/);
  const unavailable = paymentProviderNotConfigured();
  assert.equal(unavailable.code, 'PAYMENT_PROVIDER_NOT_CONFIGURED');
  const adapter = createPaymentProvider({
    async createCheckout(input) { return input; },
    async verifyWebhook(input) { return input; },
    async refund(input) { return input; }
  });
  const request = { amountCents: 50000, currency: 'PHP' };
  assert.deepEqual(await adapter.createCheckout(request), request);
});
