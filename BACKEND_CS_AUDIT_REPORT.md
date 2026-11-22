# BounceBash customer backend audit

## School/demo sign-off

The customer approved the existing five synthetic base rates and four included hours for the school demo. Classic White Castle is ₱6,500, Boho Pastel Playground ₱5,500, Rainbow Racer Slide ₱7,500, Carnival Pop Castle ₱4,500 and Pastel Ball Pit ₱3,500. Setup and pickup are included and delivery is separate. The existing ₱600 whole additional hour, free eligible ball colors, ₱400 per arch with 1–3 distinct colors, ₱800 backdrop and zero per-child charge remain in effect. The 17 NCR destinations retain the ₱200, ₱300 and ₱400 tiers. Catalog initialization, stored prices and quotation history were left intact.

Manage Booking builds its customer choices from the public payment configuration. The supplied GCash details and QR remain available in the demo with the existing confirmation notice. Their business ownership remains unverified. Bank transfer requires explicit business approval and a bank name, account name and account number. Cash requires explicit approval and instructions. Incomplete methods are hidden. The reference form is hidden when there are no configured methods. Existing payment records and API method contracts are preserved.

The targeted SQLite booking and Manage Booking run passed 36 checks. It verified the exact demo rates and included hours, the default GCash-only selector, approval and completeness checks, and payment reference and reschedule behavior. The Edge smoke run passed at 1440px, 768px and 390px, and the production asset build passed. All 15 admin hashes and the operational SQLite hash matched their previous values.

**School/demo sign-off is complete.** Production sign-off remains open pending confirmation of receiving details and live business rates, and verification of hosted email, scheduling and remote PostgreSQL. No credentials were supplied. See README.md under **Windows updates and operational verification** and the server-side variables in .env.example. No deployment, real email or financial transaction was performed.

## Follow-up verification and deployment changes

These results supersede the older browser, advisory, scheduler, catalog and build statuses in the historical audit below.

### Fixed findings

| Area | Location | Reproduction and evidence |
| --- | --- | --- |
| Published rental rates | `Bouncebash_CS/index.html` line 82 and `Bouncebash_CS/catalog-tools.js:4` | The homepage advertised hard-coded prices for unrelated package names. The homepage, Rentals and Packages now display prices and hours from the active catalog with a valid model-to-package link. Existing stored prices, durations and demo records were preserved. |
| QR asset | `Bouncebash_CS/payment-config.js:10`, `assets/payments/gcash-qr.jpg` | The original .png contained JPEG bytes. Renamed it and kept the original image bytes. Offline QR decoding succeeded, but the payload did not contain the listed mobile number in plain numeric form. This does not establish an account match. The optional bank account number is blank and the bank instructions stay hidden. |
| Same-page recovery | `Bouncebash_CS/customer-tools.js:230` | After requesting reset instructions, opening the captured link on the already open account-help page changed only the fragment. The hidden reset form never activated. Initial and same-page fragment navigation now share the mode handler, remove the fragment from history and retain it in the page for submission. |
| Cancellation keyboard focus | `Bouncebash_CS/site.js:738` | Closing the reason dialog could try to return focus while the initiating button was disabled. The profile re-enables the button before restoring focus while it remains on the page. |
| Notification scheduling | `server.js:247`, `backend/config.js`, `backend/notifications.js`, `vercel.json`, `scripts/outbox.js` | Serverless execution had no scheduled delivery. Added a five-minute authenticated scheduler endpoint with a separate secret and a configuration-only preflight. Tests reject missing and operator credentials, confirm canonical origin, accept a scheduled delivery and avoid a second send. The worker refuses redirects and checks the retry due time when claiming. |
| Hosted admin access | `vercel.json`, `scripts/build-public.js` | Previously the static build exposed the admin HTML outside Express's login redirect. Vercel configuration now routes those paths through Express and the build excludes the static admin directory. On the local API, existing authenticated staff access remains covered. Vercel rewrite behavior requires hosted verification. |
| Windows launcher and release | `START_WINDOWS.bat:9`, `scripts/package-release.py:11`, `server.js:1393` | The launcher checked only whether node_modules existed. It now checks supported Node, npm and runtime dependency loading, including a SQLite in-memory probe. Windows ZIP paths are normalized and private environment and SQLite files excluded. Startup identifies the resolved SQLite path or driver without displaying a connection URL. |
| Remote verification | `scripts/verify-remote-postgres.js:6` | Added a guarded command for TLS, schema migration, active-date index, audit protection and rollback against an explicitly authorized disposable PostgreSQL database. The command refused to proceed without the explicit test URL and flag. |
| Background price previews | `Bouncebash_CS/booking-wizard.js:44` and `test/wizard.test.js` | Edge recorded a 400 from a background quote while add-ons were still being filled. The wizard now requests the server quote on Review and rechecks it before Submit. It ignores a stale result if selections change during Review. The regression asserts the request count stays unchanged while the user is filling fields. |
| Customer inquiries | `Bouncebash_CS/booking.html:55`, wizard Review and `server.js` inquiry routes | The profile listed inquiries without a customer control to create them. Review now offers an explicit inquiry action without a date hold. The owner-only write uses the existing inquiry handler and customer list. The original intake endpoint is retained. The profile waits for session validation before loading inquiries, which avoids an unauthorized background request on an expired session. |

### Configuration matrix

| Feature | Implemented | Configured | Tested | Remaining requirement |
| --- | --- | --- | --- | --- |
| Rental catalog and approved policy | Yes | Synthetic fixtures, existing prices unchanged | Local API, DOM and real browser | Approve the production model/package list and current base rates and durations |
| Manual payment and receipts | Yes | Existing display details and asset retained | Synthetic references, exact centavos, verification and browser Print invocation | Confirm receiving number and QR designate the intended business account, and whether bank transfer is offered |
| Email bridge | Yes | Loopback capture only | HTTP capture, reset/verify links, one-time tokens, retry with stable idempotency key | Provide trusted HTTPS bridge, private key and canonical HTTPS origin in hosting settings |
| Scheduler | Yes | Repository configuration for every five minutes | Local HTTP invocation and authorization | Set separate CRON_SECRET and verify the production plan or configure an external scheduler |
| Database | SQLite and PostgreSQL adapters | Disposable SQLite and embedded PGlite | Local migrations, backup and transaction tests | An authorized isolated remote PostgreSQL database for live TLS and migration verification |
| Hosted routing and assets | Repository configuration and build | Local build | Asset and local admin access checks | Verify CDN routing and scheduler on an authorized deployment |
| Local browser automation | Runnable PowerShell instructions in README | Temporary Playwright, installed Edge | Passed on Edge at 1440px, 768px and 390px. | See verification coverage below |

### Commands and outcomes

| Command | Result |
| --- | --- |
| `npm.cmd audit --json --fetch-retries=0` with registry access | Passed. 0 vulnerabilities across runtime and development dependencies (161 dependencies reported). No package manifest or lockfile changes. |
| `npm.cmd ci --prefix TEMP_INSTALL --fetch-retries=0` | Passed in a separate temporary install. Loaded better-sqlite3 and opened an in-memory database. |
| `npm.cmd test -- --serial` with SQLite test environment | 81 passed and 0 failed. The final customer DOM and wizard rerun after the profile request fix reported 24 passed and 0 failed. |
| `npm.cmd run test:postgres` | 81 passed and 0 failed in 270.3 seconds on embedded PostgreSQL-compatible PGlite. Remote PostgreSQL remains unverified. |
| `node --test test/site-controls.test.js` | 11 passed and 0 failed, including same-tab reset link handling. A later combined run with the wizard reported 24 passed and 0 failed. |
| `node scripts/browser-smoke.cjs` | Passed. 27 viewport/page combinations across eight pages and active Manage Booking. No horizontal overflow, overlapping grid cards, duplicate IDs, unexpected failed requests, uncaught exceptions or detected CSP violations. |
| Parallel catalog reads from the booking suite | 30 requests with zero failures in each adapter. 195 ms SQLite and 982 ms PGlite batch times. Local Windows measurements only. |
| `npm.cmd run build` | Passed. Admin HTML absent from public output, unchanged JPEG present under the corrected filename. |
| `npm.cmd run outbox -- preflight` | Ran without opening a database. Reported local bridge and scheduler unconfigured, exit 1 as expected. A separate synthetic loopback configuration passed without contacting the endpoint. |
| Inline Node SQLite restart and loopback capture check | Passed. The account session, booking, hold deadline and exact pending amount survived restart. The queue retried an isolated 503 response with the same link and idempotency key. |
| `python scripts/package-release.py TEMP_ARCHIVE.zip` | Passed ZIP integrity, internal admin hash comparison and exclusion of environment/database files. |
| `START_WINDOWS.bat` with a temporary partial installation and missing lockfile | Passed. Attempted npm ci, showed an actionable error and kept the two synthetic settings and data hashes unchanged. |
| `node scripts/verify-remote-postgres.js` without the confirmation and test URL | Guard passed. Remote PostgreSQL execution remains blocked pending an authorized disposable database. |

All 15 admin SHA-256 hashes matched. The packaged operational SQLite hash also matched the pre-work hash. No operational database was migrated or seeded. Tests used synthetic fixtures and captured emails. Hosted execution and payment ownership remain unverified.

Changed files in this follow-up:

- `.env.example`, `README.md`, `BACKEND_CS_AUDIT_REPORT.md`
- `Bouncebash_CS/index.html`, `Bouncebash_CS/catalog-tools.js`, `Bouncebash_CS/booking.html`, `Bouncebash_CS/booking-wizard.js`, `Bouncebash_CS/customer-tools.js`, `Bouncebash_CS/payment-config.js`, `Bouncebash_CS/site.js`
- `assets/payments/gcash-qr.png` renamed to `assets/payments/gcash-qr.jpg`
- `backend/config.js`, `backend/notifications.js`, `server.js`, `vercel.json`
- `scripts/build-public.js`, `scripts/outbox.js`, `scripts/package-release.py`, `scripts/verify-remote-postgres.js`, `scripts/browser-smoke.cjs`, `START_WINDOWS.bat`
- `test/account-services.test.js`, `test/site-controls.test.js`, `test/wizard.test.js`

Windows backup, update, email, PostgreSQL and browser commands are in README.md under **Windows updates and operational verification**. Keep the existing .env and run the corrected read-only backup before starting updated code against an existing database.

### Browser evidence and limits

The smoke run uses Windows, Node v24.15.0, Edge 158.0.4370.33 and the live loopback Express app. It exercises signup, login, logout, profile editing, email/password changes, resend and verify, password reset in the open tab, the multi-step wizard, price review, inquiry and quotation, payment submission and staff verification, rescheduling, receipt Print invocation and paid/unpaid cancellation. It also drives calendar controls, gallery controls, FAQ empty state, keyboard mobile navigation, feedback, review filters/pagination and newsletter signup. The browser assertions verify synthetic persistence through the backend. The Print test observes the browser API call. Printer hardware and the OS print dialog remain unverified.

A held payment response checks the busy state. The intentional disconnect occurs after the server writes, and the saved payment count is checked. The final profile navigation simulates session expiry and requires a sign-in redirect. The console and network checks fail the run on unexpected errors. Gallery and FAQ remain client-side, and exhaustive visual comparison of all pages and device configurations was outside this run.

### External inputs

- The approved production model/package list, prices and included hours, plus confirmation that the displayed payment number and existing QR belong to the intended account, and whether bank transfer should be offered.
- A trusted email bridge endpoint and key configured privately, the public HTTPS origin and a scheduler plan or service. Keep credentials outside the repository.
- An empty authorized remote PostgreSQL test database for live adapter verification.

## Historical baseline

## Outcome

Manage Booking now gives recovery instructions when a submit response is lost and keeps the entered values available. The regression sends the payment to the isolated backend, drops the response, checks the inline message and restored button state, and verifies exactly one pending payment. The SQLite backup command opens the source read-only without application startup. The Windows expiry test now closes its server before removing the temporary database. The payment test also checks the exact requested confirmation and ₱2,499.99 as 249,999 centavos.

The local booking lifecycle is covered by API and DOM tests. Production booking still depends on an approved catalog and configured payment instructions. Password recovery and email verification depend on a working delivery bridge. Full visual-browser, live PostgreSQL and external-provider checks remain open.

## Architecture and deployment

- `server.js` constructs the Express 4 app, serves the local customer pages and mounts customer authentication, catalog, booking, account, review, newsletter and inquiry APIs. `api/index.js` exports the same app for Vercel. `vercel.json` routes API traffic and health checks and serves the generated `public/` assets.
- `backend/config.js` loads local environment configuration. `backend/database-local.js:5` resolves `BOUNCEBASH_DB_PATH`, then `DB_PATH`, then `data/bouncebash.sqlite`. The local adapter uses better-sqlite3. `backend/database.js` selects `DB_DRIVER` or PostgreSQL when `DATABASE_URL` is present. Production requires PostgreSQL with TLS, an HTTPS `PUBLIC_URL` and a protected operator key. PGlite is restricted to tests.
- SQLite startup upgrades the schema in `backend/database-local.js`. PostgreSQL initializes `001_postgres.sql` and applies the proof and wizard migrations under the migration lock. Accounts, sessions, one-time tokens, catalog, bookings, date blocks, line items, quote snapshots, payments, historical proofs, reviews, subscriptions, inquiries, outbox and audit data have separate tables or fields.
- Database uniqueness enforces one active booking per date and case-insensitive transaction references. SQLite uses immediate transactions. The real PostgreSQL adapter uses serializable transactions. A concurrent update can receive HTTP 409. Embedded tests exercise constraints and SQL compatibility under their own serialized adapter.
- `backend/notifications.js` queues email and uses a timed HTTP delivery bridge with leases, bounded retries and idempotency keys. The persistent server runs a timer. Vercel needs a scheduled external invocation of the worker or authenticated maintenance route for unattended delivery. Payment requires a manually checked transfer. Refund status records an external refund. Booking references require an authenticated owner.
- Local builds explicitly copy allowlisted asset types and directories. The Vercel static output contains admin HTML, and privileged data routes independently require staff or operator credentials. Local staff page redirects and Vercel static page behavior differ.

## Customer traceability

| Customer action | Frontend handler | API | Authorization and persistence | Visible result |
| --- | --- | --- | --- | --- |
| Sign up, log in, sign out | `site.js` signup, login, logout handlers | `POST /api/auth/{signup,login,logout}` | Validate inputs, bcrypt password hashes, store hashed session tokens, revoke on logout | Account or session state updates, form error |
| Open profile, edit profile or password | `loadProfileData`, `initProfileForm`, `initPasswordForm` | `GET /api/auth/session`, `GET/PUT /api/customers/me`, `PUT /api/customers/password` | Owner cookie, current password for credential change, revoke old sessions | Saved profile and status, sign-in or validation feedback |
| Change email or resend verification | `customer-tools.js` email and resend listeners | `PUT /api/customers/email`, `POST /api/auth/verification-request` | Owner cookie, password and unique address, renewal and verification outbox | Inline message |
| Recover password, verify email, unsubscribe | `initAccountHelp` | `POST /api/auth/{forgot-password,reset-password,verify-email}`, `POST /api/newsletter/unsubscribe` | Generic recovery acknowledgement, expiring one-use token for reset and verification, unsubscribe token | Account-help status |
| Browse rentals, styles, packages, add-ons | `catalog-tools.js`, wizard `init`, `cards`, `pick` | `GET /api/catalog` | Read active catalog and model/package/variant mappings | Rental cards, booking links and available options, load error |
| Pick a calendar date | `initAvailabilityCalendar`, `renderMiniCalendar`, wizard validation | `GET /api/availability[/month]` | Date validation, active whole-day bookings and staff blocks | Available dates link into booking, blocked dates disabled |
| Back, Continue, Review | Wizard `showStep`, `validate`, `updateQuote` | `GET /api/availability`, `POST /api/quotes` | Catalog compatibility and server-owned centavo pricing, browser session draft | Values retained, inline errors, breakdown on Review |
| Submit booking | Wizard submit handler | `POST /api/bookings` | Owner cookie, acknowledgement, authoritative pricing, transactional date hold, audit and outbox | Profile link and server-based countdown, conflicting date error |
| List or manage a booking | `loadProfileData`, `initBookingManagement` | `GET /api/bookings/mine`, `GET /api/bookings/:reference` | Customer-scoped list and owner check, read booking and payment history | Cards, status and timer, other customer's record returns 404 |
| Cancel and reschedule | `BBCancelBooking`, Manage Booking move form | `POST /api/bookings/:reference/{cancel,reschedule}` | Owner and future active booking checks, transaction changes status or schedule and retains payments | Profile cancellation dialog, inline changed-schedule feedback |
| Submit payment reference | Manage Booking payment form | `POST /api/bookings/:reference/payments` | Owner, final quote, amount and method validation, unique reference, pending payment and audit/outbox | “Payment reference submitted. Your payment is awaiting verification.” |
| Payment history and print | `renderPaymentHistory`, `renderReceipt` | Owner booking read | Staff verification updates payment state through `PUT /api/operator/payments/:id` | Print action contains verified payments only |
| Staff quoting, confirmation, closures | Staff/operator routes | `PUT /api/operator/bookings/:reference/{quote,status}`, date-block routes | Staff or operator authorization, keep original subtotal, require verified deposit and available date | Customer sees final price, payment eligibility or confirmed status |
| Feedback, review filters and load more | `initFeedbackForm`, `initReviews`, `initHomepageReviews` | `POST/GET /api/reviews` | Consent, public write rate limit, pending moderation, approved reads | Submission status and paginated public reviews |
| Newsletter | `initNewsletterForm` | `POST /api/newsletter` | Normalize email, rate limit, unique subscription, outbox | Subscription acknowledgement or duplicate feedback |
| Gallery, FAQ, and mobile nav | `gallery-interactions.js`, `faq-interactions.js`, `site.js` | Browser-local | Static assets and page state | Filter, load more, empty state, keyboard and menu controls |
| Inquiries | Profile inquiry list in `customer-tools.js` | `GET /api/inquiries/mine`, separate `POST /api/inquiries` | Owner-scoped listing, validated intake, operator reply and conversion | Profile lists replies. Customer navigation has no dedicated inquiry-composer workflow. |

## Findings

| Severity | Location | Reproduction, expected and actual | Disposition |
| --- | --- | --- | --- |
| Medium | `Bouncebash_CS/customer-tools.js:6`, action runner near line 211 | Click Submit for verification and drop the HTTP response after committing the payment. The form should explain how to recover safely. It previously displayed the browser's raw fetch error. | Fixed in the shared customer request helper. Regression checks pending persistence, busy state, enabled button, retained reference and visible recovery guidance. |
| Medium, test reliability | `test/manage-actions.test.js:17`, `server.js:662` | Submit a valid ₱2,499.99 reference. API sends the required success message. The test timed out waiting for “recorded,” even after the payment was persisted. | Assert the exact text and retain assertions for cents, pending status, one request, history and button recovery. Baseline PGlite reported 75 passed and 2 failed, counting the failed child and parent. |
| High, production readiness | `Bouncebash_CS/index.html:85`, `backend/demo-booking-catalog.js:3`, `OPERATOR_GUIDE.md:17` | Compare homepage offers to the wizard catalog. Homepage shows four hard-coded rates (₱4,500, ₱5,500, ₱8,500, ₱12,500) under different package names. Fixture offers have four included hours and charge ₱6,500, ₱5,500, ₱7,500, ₱4,500 and ₱3,500 respectively for Classic White Castle, Boho Pastel Playground, Rainbow Racer Slide, Carnival Pop Castle and Pastel Ball Pit. | No supplied approved mapping or authoritative duration schedule was identified. Preserve all catalog values pending business confirmation. An empty production catalog prevents a customer from selecting a bookable rental. |
| Medium, operational | `backend/notifications.js:9`, `server.js:1368`, `vercel.json` | Start with no provider or no scheduled worker on a serverless host. Recovery and verification depend on delivery. Messages can stay queued indefinitely. | Requires a trusted provider and scheduled worker in production. Tests exercised delivery to a loopback bridge. |
| Low, UX | `Bouncebash_CS/index.html:85`, other customer footers | Search markup for “sample.” Legacy publisher comments remain. Existing DOM regression checks visible rental/style copy. | Comments are invisible. Placeholder rate and contact values still require business review. |
| Medium, test reliability | `test/hold-migration.test.js:4` | Run the expiry regression on Windows SQLite. Teardown tried to remove the database directory before closing the child server, which failed after the assertions and stalled the suite. | Close the server first, then remove only the test directory. The SQLite expiry test passed after the change. |
| Medium, test reliability | `test/wizard.test.js:8` | Under load the test checked Review after two fixed 20 ms waits, before its real quote request completed. Later assertions failed from the wrong step. | Wait for the Continue button to leave its busy state within a bounded deadline and retain the original Review and submission assertions. |
| High, upgrade safety | `scripts/backup.js:2` and SQLite adapter startup | Run the backup command against a legacy copy. Importing the application adapter runs schema initialization before the backup, so the copied schema can already be upgraded. | Open the configured SQLite source read-only with better-sqlite3's backup API. The legacy regression verifies that both source and snapshot retain their original booking schema, row and foreign keys before running the upgrade twice. |

## Business rules and regression evidence

- **Isolated API and DOM with real API backing.** The booking and wizard suites exercise sign-in, owner isolation, automatic profile listing, incompatible variants, photographed selection, required controls, retained fields, Review placement, and the deposit acknowledgement. Quote tests check all 17 NCR destinations against the configured ₱200/₱300/₱400 tiers, ₱600 whole extra hours, no per-child charge, free eligible ball color, ₱400 arches with distinct colors, and a flat ₱800 backdrop with mandatory Other text. Removed extras are rejected. Whitespace notes yield final pricing and general notes hold payment until an operator quote. Integer centavos are used throughout and half-cent deposits round upward.
- **Booking and payments.** Concurrent attempts for a date produce one booking in the isolated suites. Server expiry releases pending dates and preserves confirmed bookings and payments. Countdown tests check server time and remount behavior. Manage Booking renders a nearby result after rescheduling, invalid input and duplicate references; reads and quote previews leave room for mutations. Staff independently verifies payments, and confirmation requires a verified deposit. Cancellation frees the date and preserves payment records. Profile cancellation placement and receipt printing are exercised in JSDOM.
- **Accounts and other controls.** Real HTTP account tests cover signup/login, profile changes, rotation on password/email change, one-time reset and verification, logout, moderation and subscription lifecycle. Some DOM account, review and cancellation tests use stubbed fetch, independently of the HTTP suites. Static and DOM checks cover local links, unique IDs, calendar keyboard selection, external gallery script and filters, menu Escape and FAQ empty state. The suite does not establish every negative, restart, or failure state through a visual browser.
- **Security and persistence.** Review covered parameter binding, bcrypt, hashed session/reset/verification tokens, expiry and revocation, owner and staff gates, same-origin write checks, JSON size limit, CSP and no-store API responses, transactions, financial state constraints, authorization of historical attachments and private paths. Tests cover selected controls directly, including rollback, audit immutability and access via staff session. Deployed edge and load behavior remain unverified.

## Commands and results

| Command or method | Result |
| --- | --- |
| `npm.cmd run test:postgres` | 78 passed, 0 failed. PGlite, Windows, Node v24.15.0. 250.1 seconds. This checks PostgreSQL-compatible SQL locally. |
| `npm.cmd test -- --serial` with SQLite test environment | 78 passed, 0 failed. Windows serial run against isolated SQLite files, 86.1 seconds. |
| `node` with an inline synthetic SQLite restart and backup check via the HTTP fixture | Passed. Restored backup integrity, session, profile booking, original expiry, quote and pending payment were checked. |
| `node` with inline SQLite fixture checks for rate limits, session expiry and outbox recovery | Passed. Exhausted read and write budgets independently (HTTP 429 and Retry-After), reproduced an HTTP 503 provider response, retried with a stable idempotency key, and verified HTTP 401 for an expired session. |
| `node --test test/hold-migration.test.js` with SQLite and PGlite test environments | Targeted post-backup-fix reruns. 2 passed and 0 failed in each environment. Missing-source and PostgreSQL guard checks also passed without creating a file. |
| `npm.cmd run build` | Exit 0. 79 public files, including 25 customer HTML pages. Data, environment file, server, backend, scripts and tests were excluded. |
| `npm.cmd audit --omit=dev --json --fetch-retries=0` | Blocked. Registry advisory request failed. Current advisory status is unknown. `npm.cmd ls --omit=dev --depth=0` identified bcryptjs 2.4.3, better-sqlite3 11.10.0, cookie-parser 1.4.7, Express 4.22.3 and pg 8.23.1. |
| One local `Promise.all` batch, 30 `GET /api/catalog` requests through the SQLite fixture | Windows, Node v24.15.0, loopback HTTP, synthetic catalog. 135 ms batch wall time, p50 89 ms, p95 121 ms, max 124 ms, 0 failures. This measures that single local run. Embedded suite's separate 30-read batch took 802 ms and asserted success. |
| Headless Chrome launch with a temporary profile and loopback DevTools | Blocked after two bounded attempts. Chrome's loopback DevTools HTTP and WebSocket connected, but `Page.enable` timed out. A separate Chrome `--dump-dom` attempt exited with code 2147483651. Desktop/mobile visual, console and live CSP checks remain unverified. |

## Preservation and remaining work

- The audit used isolated SQLite files and PGlite directories with synthetic records. No migration, backup, reset, reseed, or record change was performed against the workspace's operational database. Existing suites exercised a synthetic SQLite backup/restore, repeat legacy migration, foreign-key integrity, SQLite-to-PGlite import, historical payment-proof migration and rollback. A separate SQLite restart smoke check backed up the synthetic database, passed integrity and foreign-key checks, restarted the app on the same file, and verified the account session, owner profile booking, identical hold expiry, operator quote, rounded odd-cent deposit and pending payment. Complete post-restart UI coverage across all workflows remains unverified.
- Computed SHA-256 over all 15 files in `Bouncebash_Admin/` before edits and repeated afterward. All 15 relative paths and hashes match. Two read-only hashes of the packaged SQLite file taken during the audit also matched. No shared server routes or admin API contracts changed.
- **Missing UI wiring:** Inquiry intake has a backend endpoint but no dedicated customer-side inquiry form. Gallery and FAQ data are static and have no persistence requirement. Manual verification and external refunds are part of the agreed workflow.
- **Configuration:** Publish approved bookable models, compatible styles, prices and included hours, verify payment receiving instructions, and configure provider and scheduling.
- **Untested integrations and blocked checks:** Real remote PostgreSQL, Vercel deployment, real email delivery and payment reconciliation were outside the isolated run. Current package advisory results were blocked. Visual spacing, sticky headers, long-text layout, browser CSP and console coverage are limited to the browser results above. No production soak test was performed.

## Changed files and Windows instructions

- `Bouncebash_CS/customer-tools.js` handles fetch transport failures with recovery text.
- `test/manage-actions.test.js` corrects the success assertion and exercises a lost response after persistence.
- `scripts/backup.js` backs up an existing SQLite source through a read-only connection before migrations.
- `test/hold-migration.test.js` closes the isolated server before deleting its Windows test directory and checks the pre-upgrade snapshot.
- `test/wizard.test.js` waits for the real quote request through the button state.
- `BACKEND_CS_AUDIT_REPORT.md` records the audit. `public/` is generated by the asset build and is ignored.

From the nested application folder in PowerShell, use Node v22.13+ (within the supported range in `package.json`).

```powershell
Set-Location C:\Users\princ\Desktop\BounceBash\BounceBash
$env:NODE_ENV = 'test'
$env:DB_DRIVER = 'sqlite'
npm.cmd test -- --serial
npm.cmd run test:postgres
npm.cmd run build
```

To start an isolated local UI session after testing, use a new PowerShell window and an explicit disposable database path.

```powershell
Set-Location C:\Users\princ\Desktop\BounceBash\BounceBash
$env:NODE_ENV = 'test'
$env:DB_DRIVER = 'sqlite'
$env:DEMO_CATALOG = 'true'
$env:PORT = '3300'
$env:PUBLIC_URL = 'http://127.0.0.1:3300'
$env:BOUNCEBASH_DB_PATH = Join-Path $env:TEMP "bouncebash-audit-$([guid]::NewGuid()).sqlite"
npm.cmd start
```

Open `http://127.0.0.1:3300/Bouncebash_CS/`. Before any future production database migration, create a verified backup of the target database. For SQLite set `DB_DRIVER=sqlite`, point `BOUNCEBASH_DB_PATH` at the intended existing file, and run `npm.cmd run backup -- PATH_TO_NEW_BACKUP.sqlite` in a local environment. An offline snapshot with the application stopped is another option. For PostgreSQL use a database dump or a provider snapshot and verify restoration separately.
