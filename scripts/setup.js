'use strict';
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto');
const target = path.join(__dirname, '..', '.env');
if (fs.existsSync(target)) { console.log('.env already exists; kept your configuration.'); process.exit(0); }
fs.writeFileSync(target, `# Local development settings; keep this file private.\nNODE_ENV=development\nHOST=127.0.0.1\nPORT=3000\nPUBLIC_URL=http://localhost:3000\nOPERATOR_API_KEY=${crypto.randomBytes(32).toString('hex')}\nDEMO_CATALOG=true\nAUTH_RATE_LIMIT=10\nPUBLIC_RATE_LIMIT=20\n# Optional HTTPS email-provider bridge; see README.\nNOTIFICATION_WEBHOOK_URL=\nNOTIFICATION_WEBHOOK_KEY=\n`, { mode: 0o600, flag: 'wx' });
console.log('Local .env created with a unique operator key. Start with npm start.');
