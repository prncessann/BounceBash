# Bounce Bash customer website

This update completes the customer backend and its operational API. It preserves every file in `Bouncebash_Admin/` exactly as uploaded. That admin panel remains the supplied static prototype: it has not been connected or redesigned. Staff operations are available through authenticated API calls and the included command-line tool.

## Start locally on Windows

1. Install Node.js 22 or 24 and extract this ZIP completely.
2. Open the extracted **BounceBash** folder. It contains `package.json` and `server.js`.
3. Double-click **START_WINDOWS.bat**. On the first run it installs dependencies, creates a private local `.env`, and starts the server. Keep its window open.
4. Open **http://localhost:3000/Bouncebash_CS/**. Use the server URL, not Live Server or a directly opened HTML file. XAMPP/MySQL is not required for this version.

Alternatively, from a terminal in this folder:

```sh
npm ci
npm run setup
npm start
```

Stop with Ctrl+C. Existing `.env` files are never overwritten by setup. On a custom port, update both `PORT` and `PUBLIC_URL`. If a copied native SQLite dependency fails, delete `node_modules` and run `npm ci` on your own machine; do not copy another operating system's `node_modules`.

The included `data/bouncebash.sqlite` is the database from your newest upload, without test records added by this work. Startup performs additive schema migrations and invalidates legacy plaintext session cookies once. Back up an existing working database before replacing/upgrading a project. The `BOUNCEBASH_DB_PATH` environment variable remains supported.

## Implemented customer flows

- Signup, login/logout, safe profile changes, password change with old-session revocation, authenticated email changes, verification and single-use password-reset links.
- Three catalog zones, configurable models, supported variants, package/model compatibility, capacities, add-on options and quantities.
- Dynamic catalog prices/inclusions/duration and server-calculated PHP quotes with exact centavos, 50% deposit rounding, and historical booking snapshots.
- Separate inquiry submission, customer inquiry history, staff replies and idempotent conversion to a booking.
- Pending bookings, private guest tracking, account-owned history, rescheduling, cancellation, confirmation and completion rules; pending-hold expiry and manual date blocks.
- Payment-reference submission, authorized verification/rejection and external-refund recording. Verified amounts determine payment status and balance. Incomplete deposits are explicitly labelled **Partial Deposit**.
- Reviews require both publication consent and operator approval; newsletter subscriptions have private unsubscribe links.
- Private notification outbox, configured provider delivery with leases/retries and idempotency keys; safe notification metadata.
- Protected staff contracts for catalog setup, quotes, booking filters, payment verification, date blocks, inquiry workflow, moderation, operational reports and immutable audit history.
- Explicit public-file allowlists; origin/write protections; configurable persistent rate limits; hashed session/guest/account tokens; production cookies; safe errors and response headers.

## Configuration that still needs YOUR values

The code does not invent business data or credentials:

| Value | Local behavior until configured |
| --- | --- |
| Approved package prices, rental hours, inclusions | Displayed as request-a-quote; staff can set approved catalog prices or a booking-specific quote |
| Rental models, capacities, variants and package compatibility | Three zones are seeded; no invented models or color combinations are published |
| Add-on unit prices/options | Only configured options/prices are offered/quoted; unconfigured values require staff follow-up |
| Delivery charges or special-request adjustments | Staff adds an explicit explained final quote before payment; no unsupported fee is guessed |
| Email delivery provider | Messages remain in the PRIVATE outbox; no email is falsely reported as delivered |
| Production database and public domain | Local SQLite works; production requires PostgreSQL/Supabase and HTTPS configuration |

Unpriced booking requests can be recorded for team follow-up but cannot accept payment references until a total is set. Ordinary inquiries never reserve dates. The preserved capacity policy is **one active booking per date across the business**; times and models are recorded, but parallel rentals are not promised. Pending holds expire after 48 hours by default (`PENDING_HOURS`). Rescheduling returns the booking to pending and requires confirmation again. Cancellation/expiry do not automatically refund money; staff must resolve recorded payments. These rules are documented explicitly rather than assuming the business has multiple interchangeable units.

The proposal lists three zones while referring to four packages. The existing four package names are retained. Models and package relationships are configured separately; no fourth zone is invented.

## Staff operations without changing the admin pages

`npm run setup` creates a random `OPERATOR_API_KEY` in `.env`. Keep it private and never place it in customer HTML/JS. All `/api/operator/*` routes require `Authorization: Bearer <key>`.

The CLI reads the key internally:

```sh
npm run operator -- GET /catalog
npm run operator -- GET /inquiries
npm run operator -- GET /bookings
npm run operator -- GET /notifications
```

See **OPERATOR_GUIDE.md** for configuration and workflow examples. These endpoints are integration contracts for separately authorized future admin UI work; the old admin buttons do not suddenly become functional.

## Email and local account-recovery testing

Configure `NOTIFICATION_WEBHOOK_URL` and optionally `NOTIFICATION_WEBHOOK_KEY` for a trusted delivery bridge that sends email. The server POSTs JSON containing `id`, `recipient`, `kind`, message fields and sometimes a private one-use URL. It sends a stable `Idempotency-Key` and optional bearer authorization. The bridge must return 2xx only after accepting delivery, protect these payloads, and deduplicate that key. The included automated tests use a local fake provider and send no real email.

- On the local persistent server, the worker runs every 30 seconds.
- In serverless hosting, configure a trusted scheduler to POST `{}` to `/api/operator/maintenance` with the operator bearer key, normally every minute. Do not rely on background timers after an HTTP response. Each call handles up to four messages with bounded timeouts.
- `npm run outbox -- list` shows delivery status without private links.
- `npm run outbox -- deliver` attempts a configured delivery batch.
- **Local tests only:** `npm run outbox -- show-links` prints private links so you can exercise verification, reset, guest management and unsubscribe without an email account. This is disabled in production. Do not share that terminal output.

## PostgreSQL / Supabase / Vercel

The same business routes support local SQLite and PostgreSQL; production cannot silently fall back to local SQLite. The PostgreSQL schema lives in `migrations/001_postgres.sql` under the private **bouncebash** schema. Tables have RLS enabled; no public browser grants or elevated frontend keys are added. The backend connects using an appropriately secured database-owner credential. Keep this schema out of the Supabase exposed Data API schemas unless you intentionally add and test access policies.

1. Create your own Supabase/PostgreSQL project. Obtain its trusted server-side connection URL (use the connection method/pooler appropriate for your hosting network). No live project was created by this update.
2. Set `DATABASE_URL`, `DB_DRIVER=postgres`, `NODE_ENV=production`, `PUBLIC_URL=https://your-domain`, a unique `OPERATOR_API_KEY`, and provider settings as needed. Keep these in hosting environment variables. Database TLS verification is enabled; set `DATABASE_CA_CERT` if your provider requires its CA. TLS cannot be disabled in production.
3. Run `npm run migrate` against the intended database. First initialization creates the versioned schema under a migration advisory lock. Later starts do not rerun the initial migration or destroy data.
4. To transfer an existing SQLite database into a **new otherwise-empty** destination, make a backup and run:

```sh
npm run migrate:sqlite -- /absolute/path/to/backup.sqlite --confirm-empty-destination
```

The importer opens SQLite read-only, preserves business records/IDs, resets PostgreSQL sequences, and refuses to overwrite a destination containing business data. Only automatic catalog seeds are replaced in an empty destination. Sessions/recovery tokens and sensitive recovery-email payloads are not imported: users must sign in/request new links. Re-running an import against populated data is refused.

5. For Vercel, select this folder as the project root. `vercel.json`, `api/index.js`, and `npm run build` provide the function entry and an explicit public output directory. Configure environment variables and the notification scheduler. The `public` build output contains only approved public files; databases, secrets and backend source are excluded.
6. Verify deployed login, origins, cookies, persistence, provider delivery, private-file denial and backups before accepting real bookings. Preview deployments need their own correct `PUBLIC_URL` and preferably a separate test database.

The PostgreSQL SQL/business flows were tested using embedded PostgreSQL (PGlite). A live Supabase connection and a real Vercel deployment were **not** exercised because no credentials/project were supplied. The configuration and migration code are included; this is not a claim that your external accounts are already configured.

## Tests

```sh
npm test
npm run test:postgres
```

These use isolated temporary databases and synthetic data. The second command tests PostgreSQL SQL/transactions using a local embedded PostgreSQL engine; it does not contact Supabase. DOM integration tests exercise the real customer scripts against an isolated local server using jsdom. They do not substitute for visual, mobile, accessibility or cross-browser checks. See **TEST_RESULTS.md** for actual results and limitations.

## Backup and restore

For SQLite:

```sh
npm run backup
```

This makes a consistent online SQLite backup outside the public mounts. To restore: stop the server, preserve a separate backup of the current database, select the verified backup through `BOUNCEBASH_DB_PATH` (or replace the stopped local database file), and restart. Never restore over an open database or leave mismatched `-wal`/`-shm` sidecars. Backup reopening/integrity is tested. PostgreSQL/Supabase backups should use provider backups or `pg_dump`/`pg_restore`; test recovery in a separate database before replacing production data.

GitHub Pages can show static pages only; it does not host this API/database. The site must run through Node locally or the configured full backend deployment for forms to work.
