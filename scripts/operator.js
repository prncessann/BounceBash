'use strict';
const config = require('../backend/config');
(async () => {
  const [method = 'GET', route = '/bookings', raw, file] = process.argv.slice(2);
  const payload=raw==='--body-file' ? require('node:fs').readFileSync(require('node:path').resolve(file),'utf8'):raw;
  if (!config.operatorKey) throw new Error('Run npm run setup or configure OPERATOR_API_KEY in .env.');
  if (!['GET', 'POST', 'PUT'].includes(method) || !/^\/[a-zA-Z0-9_/?=&.-]*$/.test(route) || route.includes('..')) throw new Error('Use GET, POST or PUT and an operator-relative path such as /bookings.');
  const response = await fetch(new URL(`/api/operator${route}`, config.publicUrl), {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.operatorKey}` },
    ...(payload ? { body: JSON.stringify(JSON.parse(payload)) } : {}), signal: AbortSignal.timeout(15000),
  });
  console.log(JSON.stringify(await response.json(), null, 2)); if (!response.ok) process.exitCode = 1;
})().catch(e => { console.error(e.message); process.exitCode = 1; });
