'use strict';
// Usage: node scripts/create-staff.js <email> "<full name>" "<password, at least 8 characters>"
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const { db } = require('../backend/database');

(async () => {
  await db.ready;
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password || password.length < 8) {
    console.error('Usage: node scripts/create-staff.js <email> "<full name>" "<password, at least 8 characters>"');
    process.exit(1);
  }
  await db.prepare("CREATE TABLE IF NOT EXISTS staff_users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  const hashed = await bcrypt.hash(password, 10);
  await db.prepare('INSERT INTO staff_users(id,email,password_hash,name) VALUES (?,?,?,?)').run(crypto.randomUUID(), email.trim().toLowerCase(), hashed, name.trim());
  console.log('Staff account created. Sign in at /Bouncebash_Admin/login.html');
  await db.close();
})().catch(error => {
  console.error(/UNIQUE|duplicate/i.test(error.message) ? 'That email already has a staff account.' : error.message);
  process.exit(1);
});