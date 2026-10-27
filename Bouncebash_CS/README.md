# Bounce Bash PH Customer Backend

The customer website and its same-origin Express API are served together. SQLite persists customer accounts, sessions, bookings, the catalog, staff accounts, audit events, feedback, email delivery records, and newsletter preferences.

## Requirements and startup

- Node.js 20 or newer
- npm

From this directory:

```powershell
npm ci
Copy-Item .env.example .env
```

Set `SESSION_SECRET` in `.env` to a unique random value of at least 32 characters. PowerShell can generate one with:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Then start the site:

```powershell
npm start
```

Open `http://localhost:3000`. Use `npm run dev` for automatic restarts. `DATABASE_PATH` defaults to `./data/bouncebash.sqlite`; the directory and schema are initialized on startup. The database is ignored by Git.

## Database migrations and backups

The server applies ordered, transactional schema migrations recorded in `schema_migrations`. Existing databases are upgraded in place; migrations preserve the original customers, bookings, booking add-ons, sessions, catalog, newsletter subscriptions, and feedback. Seed catalog rows are inserted only when their IDs are absent, so restarts do not overwrite operator edits.

Before deploying an upgrade, stop the server and make a backup. With the app dependencies installed, SQLite's online backup API can create a consistent standalone copy:

```powershell
node -e "const Database=require('better-sqlite3'); const db=new Database(process.env.DATABASE_PATH||'./data/bouncebash.sqlite'); db.backup('./data/bouncebash-backup.sqlite').then(()=>{db.close();console.log('Backup complete')}).catch(error=>{console.error(error);db.close();process.exitCode=1})"
```

Keep production data on persistent storage, not an ephemeral container filesystem. Store backups separately, restrict access to them, and periodically test a restore. To restore, stop the server and copy a verified backup over the database file:

```powershell
Copy-Item .\data\bouncebash-backup.sqlite .\data\bouncebash.sqlite -Force
```

Do not delete or replace the live database to troubleshoot migrations. Test schema changes against a copy first; the automated migration test does so with a representative pre-migration database.

## Configuration and production

Copy `.env.example` to `.env` for local work. Never commit `.env` or real credentials.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Set to `production` for a deployment. |
| `PORT` | HTTP port; defaults to `3000`. |
| `SESSION_SECRET` | Required in production; unique random secret of at least 32 characters. |
| `DATABASE_PATH` | SQLite file location; defaults to `./data/bouncebash.sqlite`. |
| `PUBLIC_BASE_URL` | Public site URL used in email links; required with SMTP in production and must use HTTPS. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | SMTP server settings. |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | SMTP credentials and sender address. Configure all four SMTP host/account fields together. |
| `EMAIL_DEV_TOKEN` | Optional local-only switch that returns reset/verification tokens in development responses. It is ignored in production. |

Production requires HTTPS so session cookies are secure. The app sets a restrictive same-origin Content Security Policy (Google Fonts are the only external font/style origin). Deploy as a single application instance with a persistent SQLite volume; the built-in rate limiter is process-local, and SQLite is not intended for a multi-writer, horizontally scaled deployment. Configure an HTTPS reverse proxy and set `PUBLIC_BASE_URL` to the canonical public URL. Use a unique production session secret and SMTP credentials from the host's secret manager.

## First staff account and permissions

There is no public staff registration or hardcoded administrator. From a trusted local shell, create the initial administrator:

```powershell
npm run create-staff
```

The command prompts for name, email, and a hidden password (14–72 characters). It creates the administrator only if no staff account exists and accepts no credentials on the command line. After that, an authenticated administrator can create additional staff accounts through `POST /api/staff/users`.

Staff sessions are separate from customer sessions, expire after one hour, are stored in SQLite, and are checked against the staff account's active state and session version on every staff request. Customer accounts cannot access staff routes. `admin` can manage the catalog and staff users; `manager` can process bookings, feedback, and newsletter exports. Both roles can authenticate using the staff-specific login endpoint. Staff password changes require the current password and invalidate existing sessions.

## Booking lifecycle and availability

- New requests begin as `pending`.
- Staff can transition `pending` to `confirmed`, `rejected`, or `cancelled`.
- Staff can transition `confirmed` to `cancelled` or `completed`.
- Rejected, cancelled, and completed are terminal states. Invalid/repeated state changes return a conflict response.
- Customers can cancel only their own upcoming `pending` bookings.
- Every initial request and lifecycle change is kept in `booking_events` with actor and status details.
- A `pending` or `confirmed` request reserves its selected inflatable for the entire date. Requests for the same model/date cannot overlap. This retains the existing full-day inventory model; event times do not create separate availability slots.
- A booking requires a verified customer email, valid future date, active catalog selections, model capacity compliance, and an `Idempotency-Key`. Prices are calculated server-side from the active package and add-ons.
- Existing seed prices are sample Philippine peso values. Verify and update the catalog before accepting real orders.

## Customer API

All API routes use `/api`. Customer authentication uses an HTTP-only, same-site SQLite-backed session cookie.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/catalog` | Active packages, models, and add-ons |
| `GET` | `/api/availability?month=YYYY-MM` | Full-day reservations; invalid month values are rejected |
| `POST` | `/api/auth/register` | Register and start a customer session |
| `POST` | `/api/auth/login` | Customer login |
| `POST` | `/api/auth/logout` | Customer logout |
| `GET` | `/api/auth/me` | Current customer |
| `PATCH` | `/api/customer/profile` | Update name/contact |
| `POST` | `/api/customer/password` | Change password; requires current password and logs out all sessions |
| `POST` | `/api/auth/password-reset` | Request reset; response does not disclose whether the address exists |
| `POST` | `/api/auth/password-reset/confirm` | Consume a one-use, one-hour reset token |
| `POST` | `/api/auth/email/verification` | Send/resend verification |
| `POST` | `/api/auth/email/verification/confirm` | Consume verification token |
| `POST` | `/api/customer/email-change` | Request an email change; requires current password |
| `POST` | `/api/customer/email-change/confirm` | Verify new address and invalidate sessions |
| `POST` | `/api/customer/deactivate` | Deactivate account after password confirmation; preserves booking/financial history |
| `POST` | `/api/bookings` | Create a booking; requires sign-in, verified email, and `Idempotency-Key` |
| `GET` | `/api/bookings` | Current customer's booking history |
| `GET` | `/api/bookings/:id` | A booking owned by the current customer |
| `POST` | `/api/bookings/:id/cancel` | Cancel an eligible pending booking |
| `POST` | `/api/newsletter` | Subscribe with explicit consent |
| `POST` | `/api/newsletter/unsubscribe/request` | Request an emailed one-use unsubscribe link |
| `POST` | `/api/newsletter/unsubscribe` | Use an unsubscribe token; token is single-use and expires after one hour |
| `POST` | `/api/feedback` | Submit feedback for review |

Passwords are bcrypt-hashed. Reset, email-verification, email-change, and unsubscribe tokens are random and stored only as SHA-256 hashes. Sensitive token requests are rate limited. Email existence is not disclosed in password-reset or unsubscribe-request responses.

## Staff API contract for `Bouncebash_Admin`

The separate admin frontend should call these same-origin endpoints using the staff session cookie (`credentials: 'same-origin'` for same-origin requests). Do not send customer session IDs or include credentials in query strings.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/staff/auth/login` | Public, rate limited | Create a staff session |
| `GET` | `/api/staff/auth/me` | Staff | Current staff identity and role |
| `POST` | `/api/staff/auth/logout` | Staff | End staff session |
| `POST` | `/api/staff/auth/password` | Staff | Change password; invalidates sessions |
| `GET` | `/api/staff/users` | Admin | List staff identities, not password data |
| `POST` | `/api/staff/users` | Admin | Create staff account with a 14+ character password |
| `GET` | `/api/staff/bookings?status=&from=&to=&q=&page=&limit=` | Staff | Filter/search bookings |
| `GET` | `/api/staff/bookings/:id` | Staff | Booking, necessary customer details, and audit history |
| `PATCH` | `/api/staff/bookings/:id/status` | Staff | Validated lifecycle transition; optional note |
| `GET` | `/api/staff/feedback?status=` | Staff | Read feedback for moderation |
| `PATCH` | `/api/staff/feedback/:id` | Staff | Set `approved`, `rejected`, or `resolved` |
| `GET` | `/api/staff/newsletter` | Staff | View recent subscription records |
| `GET` | `/api/staff/newsletter?format=csv` | Staff | Export active subscribers as formula-safe CSV |
| `GET` | `/api/staff/catalog` | Admin | Read full catalog including inactive items |
| `POST` | `/api/staff/catalog/packages` | Admin | Create package |
| `POST` | `/api/staff/catalog/models` | Admin | Create inflatable model |
| `POST` | `/api/staff/catalog/addons` | Admin | Create add-on |
| `PATCH` | `/api/staff/catalog/{packages,models,addons}/:id` | Admin | Update item, price/capacity, or active status |
| `DELETE` | `/api/staff/catalog/{packages,models,addons}/:id` | Admin | Deactivate item (soft delete; history is retained) |

All write requests are same-origin checked and validated on the server. Staff identities are checked on each request; assigning a role in a request does not authenticate a customer as staff.

## Email and notifications

Set the SMTP variables and `PUBLIC_BASE_URL` to enable verification, password reset, email change, unsubscribe links, and queued booking notifications. Authentication/verification emails are sent directly after token creation; if delivery fails, the customer can request another link. Non-sensitive booking/status notifications use a persistent outbox with retry scheduling and recovery of interrupted sends. Tests use no SMTP and never send real email unless SMTP is explicitly configured.

For local development without SMTP, set `EMAIL_DEV_TOKEN=true` with `NODE_ENV=development`; token-request responses then include the one-time token to exercise the flow locally. This option is never honored in production. Do not enable it on a public development server.

Newsletter subscriptions require explicit consent. Customers can request an unsubscribe link by email; unsubscribe tokens are hashed, expire, and cannot be reused. A later subscribe request can reactivate an address only when the requester again submits explicit consent. No bulk campaigns are implemented.

## Payment status

No payment provider or credentials are configured. `server/payment-provider.js` defines the adapter contract (`createCheckout`, `verifyWebhook`, and `refund`), and the database includes payment and provider-event tables as safe groundwork. There is no checkout, payment success path, refund endpoint, or webhook endpoint. No payment is marked successful by a browser redirect, and no card details are collected or stored. A real integration still requires a provider choice, merchant credentials, signed-webhook contract, and confirmed business decisions for currency, deposit/balance policy, refunds, and booking/payment state coupling. Do not treat bookings as paid.

## Tests and checks

Run:

```powershell
npm test
```

The suite uses isolated temporary SQLite files and covers the customer flow, authorization, staff setup and roles, bookings and conflicts, lifecycle audit, catalog validation, feedback review, newsletter consent/unsubscribe, password/email lifecycle, token expiry/reuse, retry scheduling, and preserving data while migrating a representative legacy database.
