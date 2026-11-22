'use strict';
const path = require('node:path');
const fs = require('node:fs');
// Node 20.12+ has a built-in .env parser; no additional dependency required.
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile) && process.loadEnvFile) process.loadEnvFile(envFile);
const production = process.env.NODE_ENV === 'production';
const publicUrl = new URL(process.env.PUBLIC_URL || `http://localhost:${Number(process.env.PORT) || 3000}`);
if (!['http:', 'https:'].includes(publicUrl.protocol)) throw new Error('PUBLIC_URL must be HTTP or HTTPS.');
const operatorKey = process.env.OPERATOR_API_KEY || '';
const cronSecret = process.env.CRON_SECRET || '';
const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL || '';
const webhookKey = process.env.NOTIFICATION_WEBHOOK_KEY || '';
if (cronSecret && (cronSecret.length < 32 || cronSecret === operatorKey)) {
  throw new Error('CRON_SECRET must be a separate secret of at least 32 characters.');
}
if (webhookUrl) {
  let endpoint;
  try { endpoint = new URL(webhookUrl); } catch { throw new Error('Invalid NOTIFICATION_WEBHOOK_URL.'); }
  const localCapture = !production && endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
  if ((!localCapture && endpoint.protocol !== 'https:') || endpoint.username || endpoint.password || endpoint.hash) {
    throw new Error('Use an HTTPS notification endpoint without embedded credentials or fragments.');
  }
  if (production && !webhookKey) throw new Error('Production notification delivery requires NOTIFICATION_WEBHOOK_KEY.');
}
if (operatorKey && operatorKey.length < 32) throw new Error('OPERATOR_API_KEY must contain at least 32 characters.');
if (production && (publicUrl.protocol !== 'https:' || !operatorKey)) {
  throw new Error('Production requires an HTTPS PUBLIC_URL and an OPERATOR_API_KEY.');
}
function positiveEnv(name, fallback, max) {
  const n = Number(process.env[name] || fallback);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`Invalid ${name}.`);
  return n;
}
module.exports = {
  production, publicUrl, operatorKey, cronSecret, webhookUrl, webhookKey,
  demoCatalog: !production && process.env.NODE_ENV !== 'test' && process.env.DEMO_CATALOG !== 'false' || !production && process.env.DEMO_CATALOG === 'true',
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '127.0.0.1',
  secureCookies: production || publicUrl.protocol === 'https:',
  pendingHours: 3,
  authLimit: positiveEnv('AUTH_RATE_LIMIT', 10, 10000),
  quoteLimit: positiveEnv('QUOTE_RATE_LIMIT',120,10000),
  readLimit: positiveEnv('BOOKING_READ_RATE_LIMIT',120,10000),
  bookingActionLimit: positiveEnv('BOOKING_ACTION_RATE_LIMIT',30,10000),
  publicLimit: positiveEnv('PUBLIC_RATE_LIMIT', 20, 10000),
};
