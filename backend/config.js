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
  production, publicUrl, operatorKey,
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '127.0.0.1',
  secureCookies: production || publicUrl.protocol === 'https:',
  pendingHours: positiveEnv('PENDING_HOURS', 48, 720),
  authLimit: positiveEnv('AUTH_RATE_LIMIT', 10, 10000),
  publicLimit: positiveEnv('PUBLIC_RATE_LIMIT', 20, 10000),
  webhookUrl: process.env.NOTIFICATION_WEBHOOK_URL || '',
  webhookKey: process.env.NOTIFICATION_WEBHOOK_KEY || '',
};
