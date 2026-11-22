'use strict';
const { db } = require('./database');
const config = require('./config');
async function enqueue(recipient, kind, payload) {
  if (!recipient) return;
  await db.prepare('INSERT INTO notifications(recipient, kind, payload, next_attempt_at) VALUES (?,?,?,?)')
    .run(recipient, kind, JSON.stringify(payload), new Date().toISOString());
}
let running = false;
async function deliver() {
  if (running || !config.webhookUrl) return;
  running = true;
  try {
    await db.prepare("UPDATE notifications SET status='pending' WHERE status='processing' AND next_attempt_at<=?").run(new Date().toISOString());
    const rows = await db.prepare("SELECT * FROM notifications WHERE status='pending' AND next_attempt_at <= ? ORDER BY id LIMIT 4").all(new Date().toISOString());
    for (const row of rows) {
      const claim=await db.prepare("UPDATE notifications SET status='processing',next_attempt_at=? WHERE id=? AND status='pending' AND next_attempt_at<=?").run(new Date(Date.now()+120000).toISOString(),row.id,new Date().toISOString());
      if(!claim.changes)continue;
      try {
        const response = await fetch(config.webhookUrl, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `bouncebash-notification-${row.id}`,
            ...(config.webhookKey ? { Authorization: `Bearer ${config.webhookKey}` } : {}) },
          body: JSON.stringify({ id: row.id, recipient: row.recipient, kind: row.kind, ...JSON.parse(row.payload) }),
        });
        if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
        await db.prepare("UPDATE notifications SET status='sent', attempts=attempts+1, sent_at=?, payload='{}', last_error=NULL WHERE id=?").run(new Date().toISOString(), row.id);
      } catch (error) {
        const attempts = row.attempts + 1;
        await db.prepare('UPDATE notifications SET status=?, attempts=?, last_error=?, next_attempt_at=? WHERE id=?')
          .run(attempts >= 8 ? 'failed' : 'pending', attempts, String(error.message).slice(0, 200),
            new Date(Date.now() + Math.min(3600000, 30000 * 2 ** attempts)).toISOString(), row.id);
      }
    }
  } finally { running = false; }
}
module.exports = { enqueue, deliver };
