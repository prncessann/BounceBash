const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

async function getAvailablePort() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const { port } = listener.address();
  await new Promise((resolve, reject) => {
    listener.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function waitForServer(child, baseUrl) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Test server exited with code ${child.exitCode}.`);
    }

    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      await delay(100);
    }
  }
  throw new Error('Test server did not become ready.');
}

async function apiRequest(baseUrl, route, { method = 'GET', body, cookie, operator=false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  if(operator)headers.Authorization='Bearer '+ 'test-operator-key-12345678901234567890';

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  return { response, payload };
}

test('customer API supports core flows and rejects invalid JSON body shapes', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncebash-api-'));
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      OPERATOR_API_KEY:'test-operator-key-12345678901234567890',
      BOUNCEBASH_DB_PATH: path.join(tempDir, 'test.sqlite'),
    },
    stdio: ['ignore','pipe','inherit'],
  });

  t.after(async () => {
    if (child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  await waitForServer(child, baseUrl);

  await t.test('health and catalog return initialized data', async () => {
    const health = await apiRequest(baseUrl, '/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.payload.status, 'ok');

    const catalog = await apiRequest(baseUrl, '/api/catalog');
    assert.equal(catalog.response.status, 200);
    assert.equal(catalog.payload.packages.length, 4);
    assert.equal(catalog.payload.addOns.length, 6);
  });

  let cookie;
  await t.test('signup creates an authenticated profile', async () => {
    const signup = await apiRequest(baseUrl, '/api/auth/signup', {
      method: 'POST',
      body: { name: 'Test Customer', email: 'customer@example.test', password: 'Test-password-2026' },
    });
    assert.equal(signup.response.status, 201);
    cookie = signup.response.headers.get('set-cookie').match(/session_token=[^;]+/)[0];
    assert.equal(signup.payload.user.email, 'customer@example.test');

    const profile = await apiRequest(baseUrl, '/api/customers/me', { cookie });
    assert.equal(profile.response.status, 200);
    assert.equal(profile.payload.user.name, 'Test Customer');
  });

  await t.test('booking submission updates availability and customer bookings', async () => {
    const eventDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const bookingBody = {
      name: 'Test Customer',
      contact: '09170000000',
      eventDate,
      eventTime: '13:00',
      venue: 'Test Venue',
      packageName: 'Little Bounce',
      children: 8,
      addOns: ['Ball colors'],
      reservationFeeAccepted: true,
    };
    const booking = await apiRequest(baseUrl, '/api/bookings', { method: 'POST', body: bookingBody, cookie });
    assert.equal(booking.response.status, 201);
    assert.match(booking.payload.booking.reference, /^BB-/);

    const availability = await apiRequest(baseUrl, `/api/availability?date=${eventDate}`);
    assert.equal(availability.payload.available, false);

    const monthAvailability = await apiRequest(
      baseUrl,
      `/api/availability/month?year=${eventDate.slice(0, 4)}&month=${Number(eventDate.slice(5, 7))}`,
    );
    assert.equal(monthAvailability.response.status, 200);
    assert.equal(monthAvailability.payload.unavailableDates[0].date, eventDate);

    const duplicate = await apiRequest(baseUrl, '/api/bookings', { method: 'POST', body: bookingBody, cookie });
    assert.equal(duplicate.response.status, 409);

    const mine = await apiRequest(baseUrl, '/api/bookings/mine', { cookie });
    assert.equal(mine.response.status, 200);
    assert.equal(mine.payload.bookings[0].reference, booking.payload.booking.reference);
  });

  await t.test('reviews respect feature consent and newsletter rejects duplicates', async () => {
    const privateReview = await apiRequest(baseUrl, '/api/reviews', {
      method: 'POST',
      body: { name: 'Private Reviewer', rating: 4, message: 'Keep this private.', canFeature: false },
    });
    assert.equal(privateReview.response.status, 201);

    const publicReview = await apiRequest(baseUrl, '/api/reviews', {
      method: 'POST',
      body: { name: 'Public Reviewer', rating: 5, message: 'Share this review.', canFeature: true },
    });
    assert.equal(publicReview.response.status, 201);

    const reviews = await apiRequest(baseUrl, '/api/reviews');
    assert.equal(reviews.payload.total, 0);
    const approval = await apiRequest(baseUrl, '/api/operator/reviews/' + publicReview.payload.reviewId, {method:'PUT',body:{status:'approved'},operator:true});
    assert.equal(approval.response.status,200);
    const approved = await apiRequest(baseUrl,'/api/reviews');
    assert.equal(approved.payload.total,1);
    assert.equal(approved.payload.reviews[0].message, 'Share this review.');

    const subscription = await apiRequest(baseUrl, '/api/newsletter', {
      method: 'POST',
      body: { email: 'updates@example.test' },
    });
    assert.equal(subscription.response.status, 201);
    const duplicate = await apiRequest(baseUrl, '/api/newsletter', {
      method: 'POST',
      body: { email: 'updates@example.test' },
    });
    assert.equal(duplicate.response.status, 409);
  });

  await t.test('malformed JSON and JSON primitives return structured 400 responses', async () => {
    const malformed = await fetch(`${baseUrl}/api/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid',
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: 'Request body must be valid JSON.' });

    const primitive = await fetch(`${baseUrl}/api/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null',
    });
    assert.equal(primitive.status, 400);
    assert.deepEqual(await primitive.json(), { error: 'Request body must be a JSON object.' });
  });

  await t.test('logout revokes the session', async () => {
    const logout = await apiRequest(baseUrl, '/api/auth/logout', { method: 'POST', cookie });
    assert.equal(logout.response.status, 200);

    const session = await apiRequest(baseUrl, '/api/auth/session', { cookie });
    assert.equal(session.payload.authenticated, false);
  });
});
