'use strict';
const config = require('../backend/config');
if (process.argv[2] === 'preflight') {
  console.log(JSON.stringify({ bridgeConfigured: Boolean(config.webhookUrl), bridgeKeyConfigured: Boolean(config.webhookKey), schedulerConfigured: Boolean(config.cronSecret), publicOrigin: config.publicUrl.origin }));
  if (!config.webhookUrl || (process.env.VERCEL && !config.cronSecret)) process.exitCode = 1;
} else {
const { db } = require('../backend/database'); const { deliver } = require('../backend/notifications');
(async () => {
  await db.ready;
  const mode = process.argv[2] || 'list';
  if (mode === 'deliver') {
    if (!config.webhookUrl) throw new Error('No notification provider configured. Set NOTIFICATION_WEBHOOK_URL first.');
    await deliver();
  } else if (mode === 'show-links') {
    if (config.production) throw new Error('Local test links are disabled in production. Configure delivery instead.');
    console.log('PRIVATE LOCAL TEST LINKS — do not share this output or use real customer data in local tests.');
    for (const row of await db.prepare("SELECT id,recipient,kind,payload FROM notifications WHERE status='pending' ORDER BY id DESC LIMIT 30").all()) {
      const p = JSON.parse(row.payload); if (p.url) console.log(JSON.stringify({ id: row.id, recipient: row.recipient, kind: row.kind, url: p.url }));
    }
  } else if (mode === 'list') {
    console.table(await db.prepare('SELECT id,kind,status,attempts,created_at,last_error FROM notifications ORDER BY id DESC LIMIT 50').all());
  } else throw new Error('Use preflight, list, deliver, or show-links.');
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.close());
}
