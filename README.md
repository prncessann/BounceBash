# BounceBash

A customer booking website and integrated staff administration system for an inflatable and party-rental service. Developed by Group 7, BSIS 3A, for CC312-M Website Development at the Technological University of the Philippines – Manila.

## Project information

- **Course:** CC312-M – Website Development
- **Group:** Group 7, BSIS 3A
- **Professor:** Prof. Mary Joy Viñas
- **Repository:** https://github.com/prncessann/BounceBash
- **Application version:** 1.2.1
- **Current scope:** Locally operated school/demo system. Live deployment, real email and verified commercial payment instructions remain pending.
- **Live website:** Not yet verified; add the actual tested public URL after deployment.

## Project overview

BounceBash allows customers to browse inflatable rentals, check date availability, select decorations, review prices and submit reservations or inquiries. Signed-in customers manage their bookings, payment references and receipts through their accounts. Staff maintain bookings, quotations, payment verification, catalog prices, availability, articles, feedback and public business settings using the same backend records.

The project demonstrates responsive frontend development, JavaScript interactions, server-side validation, authentication and persistent database integration. It does not process online transfers or automatically verify a payment reference.

## Team members and roles

The role assignments below follow the group's Documentation tab. Assignments describe responsibilities and are not calculated from Git contribution statistics.

| Team member | Assigned role(s) |
| --- | --- |
| Delos Reyes, Princess Ann A. | Project Manager / Team Lead; Backend Developer |
| Baniqued, Hazel D. | Frontend Developer |
| Cal, John Erick S. | Backend Developer |
| Diaz, Ashley P. | UI/UX Designer; QA / Tester |
| Suarez, Allyson S. | Frontend Developer |

The team lead coordinates tasks, progress and submission evidence. UI/UX covers layouts and visual consistency. Frontend work covers responsive pages and API interactions. Backend work covers APIs, persistence, access rules and booking/payment logic. QA covers workflows, validation, responsiveness and regression checks.

## Main features

- Customer catalog with five configured demonstration rentals, photographs, compatible variants and optional add-ons.
- Four-step booking wizard, server-calculated prices and review before submission.
- Signed-in profiles and owner-restricted booking access.
- Three-hour pending booking holds, shared date availability and staff calendar blocks.
- Separate inquiries that do not hold a date; staff can reply and convert an inquiry subject to availability.
- Manual transaction-reference submission and staff payment verification.
- Summary and printable receipt after the required deposit is verified; a same-page rescheduling dialog and eligible profile cancellation.
- Seven connected staff areas: Dashboard, Bookings, Calendar, Reports, Packages, Blog & Feedback, and Settings.
- Staff-editable catalog/pricing policy, article publication and consent-based feedback moderation.
- CSV reports, browser printing, audit records, backup scripts and regression tests.

## Technology and folder structure

| Location / technology | Purpose |
| --- | --- |
| `Bouncebash_CS/` | Customer HTML, CSS and vanilla JavaScript |
| `Bouncebash_Admin/` | Staff pages and interface scripts |
| `assets/` | Shared branding, photographs and public payment images |
| `server.js`, `backend/` | Node.js / Express API and business services |
| `migrations/` | Database schema upgrades |
| `scripts/` | Setup, migration, backup, testing and build utilities |
| `test/`, `tests/` | Regression tests, fixtures and supporting records |
| SQLite / `better-sqlite3` | Default local persistent database |
| PostgreSQL / `pg` | Optional remote database adapter |
| PGlite / jsdom | Embedded database and DOM testing |

## Documentation and verification records

- `OPERATOR_GUIDE.md`: operational routes and staff tooling.
- `ADMIN_CS_INTEGRATION_REPORT.md`: shared customer/staff implementation, financial definitions, recorded tests and remaining constraints.
- `BACKEND_CS_AUDIT_REPORT.md`: customer backend review and verification records.
- `TEST_RESULTS.md`: earlier test records; consult the latest integration report when results differ by version.

The included integration report records 84 passing tests per SQLite and embedded PostgreSQL adapter, plus Edge smoke checks at 1440, 768 and 390 pixels. These are recorded local results, not a claim of a verified hosted system or a new test execution for this README.

## Version control and submission evidence

Use clear commit messages for genuine changes and push through the project's normal Git workflow. Do not fabricate or backdate commits. This README does not establish commit frequency, contribution counts or the current remote branch status; these must be inspected in the actual repository's history.

Keep `.env`, API keys, database files, backups and `node_modules` out of Git. Preserve existing configuration and operational data when updating the application. The professor's final submission also requires actual screenshots of local VS Code development, the GitHub repository and the live website, plus the repository and live URLs.

GitHub Pages hosts static assets and cannot independently run this Node.js backend or persistent database. A full deployment needs a hosted API/database and verified routing. Vercel configuration is supplied as a possible route; no completed deployment is claimed.

---

## Download-and-run instructions

Extract this ZIP directly into your existing BounceBash project folder and replace the program files. The ZIP deliberately contains no .env or live database, so extraction preserves your current settings, accounts and bookings automatically. Double-click START_WINDOWS.bat to install dependencies if needed, create any missing local settings and start the application. No manual file copying is needed. For a fresh installation, the server creates the database and demonstration catalog automatically. Requires Node.js 22.13+ or 24.

## Customer booking and Admin integration

This release implements the agreed customer booking wizard and pricing rules. The current Admin and customer site share database records. The existing staff sign-in and sidebar design are retained. Customer booking, quote and payment rules are enforced on the shared backend.

## Run on Windows

Extract the ZIP completely. Open the **BounceBash** folder that contains `package.json`, then run:

```powershell
npm ci
npm run setup
npm start
```

Open **http://localhost:3000/Bouncebash_CS/**. Alternatively double-click `START_WINDOWS.bat`. Keep the server terminal open. Use Node.js 22.13+ or 24, not Live Server; XAMPP/MySQL is not needed. Run commands inside this folder, not its parent. If port 3000 is occupied, stop your previous server with Ctrl+C. To use another port, change both `PORT` and `PUBLIC_URL` in `.env`.

Keep a backup of your current project, `.env` and database before replacing files. Private `.env` credentials and installed dependencies are deliberately excluded. Setup creates a new local `.env` only if none exists. Retain your existing `.env` when continuing an existing deployment. This download excludes the live SQLite database so extracting over an existing project cannot overwrite bookings. A fresh installation creates its database automatically. Startup migrates a working copy in place; SQLite upgrades rebuild the bookings table to allow an absent historical child count, preserving IDs, links and existing values. Back up before upgrading.

## Booking behavior

1. Select a photographed rental and a supported synthetic style/color. Optional zone filters help browse.
2. Enter event details, NCR city/municipality, complete address, additional hours and optional notes.
3. Choose free ball colors where applicable, optional balloon arches or a backdrop. Back / Review booking controls retain entered values.
4. The final Review step shows the price breakdown after all questions. Review it, acknowledge the deposit and submit. Sign-in is required. The booking appears automatically on the customer's profile. Review can also send a staff inquiry without placing a hold. See My Inquiries in the profile for status and replies.

Invalid required fields turn red with an inline explanation. Draft choices are saved for up to 24 hours in the same browser tab, including across sign-in. Sample colors are illustrative rather than photographs of every actual material variant.

### Demonstration prices

Local development supplies five demo offers only when those rental names do not already exist. Repeated startup does not overwrite existing rental records or operator prices. These prices and four-hour durations are approved for the school demo. Photos are illustrative, and live business rates remain unverified. Existing package and quotation history is preserved.

| Rental | Included hours | Base price |
| --- | ---: | ---: |
| Classic White Castle | 4 | ₱6,500 |
| Boho Pastel Playground | 4 | ₱5,500 |
| Rainbow Racer Slide | 4 | ₱7,500 |
| Carnival Pop Castle | 4 | ₱4,500 |
| Pastel Ball Pit | 4 | ₱3,500 |

| Extra | Price / rules |
| --- | --- |
| Ball-color selection | +₱0 for rentals with balls; dropdown, no quantity |
| Balloon arch | +₱400 per arch; 1–3 distinct colors included; quantity 1–20 |
| Backdrop | +₱800, same for every event; Other requires a short description |
| Additional rental hour | +₱600 per whole hour; 0–12 additional hours |
| Number of children | No input or charge; equipment safety limits still apply |

Table styling and balloon garland are unavailable for new bookings. Historical selections remain stored. The public Styles tab is removed; old `styles.html` links redirect to Rentals.

| Delivery fee | NCR city / municipality |
| --- | --- |
| ₱200 | Quezon City |
| ₱300 | Caloocan, Malabon, Mandaluyong, Manila, Marikina, Pasig, San Juan, Valenzuela |
| ₱400 | Las Piñas, Makati, Muntinlupa, Navotas, Parañaque, Pasay, Pateros, Taguig |

These are fixed demo zones, not road-distance estimates. Full venue address remains required. Setup and pickup are included in the demo offer; delivery is added once in the displayed total.

### Notes, payments and holds

- Empty/whitespace-only notes: the displayed total is final, including extras and delivery; the deposit is 50%, rounded up to the centavo.
- Any nonempty note: show the known subtotal and **pending admin quotation**. No final total, deposit or payment submission is available until an authorized operator sets the final amount. The original breakdown remains in the quote snapshot. Backdrop Other text is structured customization and does not alone trigger this rule.
- Submission immediately reserves the whole date across the business for **three hours**, including time awaiting quotation. Public calendars show Unavailable, while the owner sees the actual approval state and server-based countdown. No parallel rentals are promised.
- Expiry releases a pending date. Confirmed bookings never expire through this timer. The backend checks expiry on API requests and every 30 seconds while running. Reloading does not renew a hold; an explicit valid reschedule starts a new pending hold and requires confirmation again.
- Payments use manual transaction-reference entry. No customer proof upload or OCR is offered. A reference is pending until staff verifies it; it never automatically confirms the booking. Historical proofs remain stored behind authenticated access.
- Cancelled/expired bookings retain payment records. Staff can record a late verification without reserving the date again; refunds require separate handling. No automatic transfer, charge, refund or reconfirmation occurs.
- The highlighted Print receipt button appears only for verified payments. It prints a system payment summary, not an official receipt.
- Customer access requires the signed-in owner. Private tracking codes and guest-token access are removed. Historical guest records remain accessible to authorized staff and are not automatically claimed by matching names/phone numbers.

## Configuration and staff operations

`DEMO_CATALOG=true` enables local demo bootstrap. It defaults on in development and is always disabled in production. Disabling bootstrap does not delete already-created demo offers; deactivate them before live use. Configure real offers, supported model mappings and variants using the protected operator APIs. A model mapped to exactly one priced package can be booked without a separate package dropdown. Staff can also maintain offers, variants and effective pricing policy through the Packages area. The optional `includesBalls` boolean on model creation/update controls free ball-color choices. Demo offer, delivery, extra-hour and add-on policy constants are in `backend/demo-booking-catalog.js` and `backend/booking-rules.js`.

`OPERATOR_GUIDE.md` describes existing operator endpoints and CLI. Finalize notes quotations with authenticated `PUT /api/operator/bookings/:reference/quote`, body `{"total":"7000.00","note":"Approved quotation explanation"}`. The integrated staff interface supports quotations, and this endpoint remains available for authorized staff tools. New fixed add-on rules take precedence over legacy add-on pricing/options fields; historic totals are never recomputed.

To create a staff account, use `node scripts/create-staff.js EMAIL "FULL NAME" "PASSWORD"` with your own values. Existing staff accounts in the database remain available. Keep `.env` and `OPERATOR_API_KEY` private.

The school demo retains the supplied GCash configuration for recording synthetic references. The receiving account and QR remain unverified. In payment-config.js, bank transfer appears only when businessApproved is true and bankName, accountName and accountNumber are all filled. Cash follows the same approval rule and also requires instructions. Without a configured method, customers see the contact-team instructions and the reference form is hidden. Keep this browser configuration limited to public receiving instructions. Notification emails require a configured trusted delivery bridge (`NOTIFICATION_WEBHOOK_URL` and key). Without one, notifications remain queued; this release does not invent email delivery credentials.

### PostgreSQL / deployment

SQLite is the default local database. For PostgreSQL set `DB_DRIVER=postgres`, a valid private `DATABASE_URL`, TLS configuration and an HTTPS `PUBLIC_URL` in production. Schema migrations 001–003 apply automatically; `npm run migrate` initializes the schema explicitly. `npm run migrate:sqlite -- PATH --confirm-empty-destination` migrates a backed-up SQLite source into an empty PostgreSQL destination. Do not use a file database for a hosted serverless production deployment. `npm run build` builds an explicit public asset directory without database/config/source files.

## Verification

Run `npm test` and `npm run test:postgres`. The second command uses embedded PostgreSQL-compatible PGlite, not a live production PostgreSQL/Supabase service. `TEST_RESULTS.md` identifies tested behavior and limitations; included logs contain the actual test runs. See BACKEND_CS_AUDIT_REPORT.md for the latest real Edge browser results, isolated provider checks and remaining hosted verification.

### Customer layout refinement

The booking wizard now uses a single column with the price breakdown only in the final Review step. The redundant paid-extras button and the “Synthetic demo rates and options.” caption are removed. Customer card grids use flexible tracks and consistent spacing. Cancellation is opened from the profile button beneath the booking status, including paid pending/confirmed future bookings; it uses a reason dialog rather than a separate Manage Booking section. Existing recorded payments remain attached and refunds are handled separately.

### Final controls fix

Restart your existing server after extracting this update. The backend now separates price-preview/read quotas from authenticated booking writes; old .env settings remain compatible. Manage Booking displays feedback beside each action, prevents repeat clicks, and retains manual payment verification. BACKEND_REVIEW.md lists tested controls, remaining real-service configuration and the visual-browser limitation.


## Windows updates and operational verification

For an existing installation, retain your current .env and locate the database used by its current server before starting the updated code. The startup line reports the resolved absolute SQLite path or the database driver. An explicit BOUNCEBASH_DB_PATH takes precedence over DB_PATH. A relative path resolves from the server's working directory. The default is data/bouncebash.sqlite within this application folder. Run START_WINDOWS.bat or run commands from the application folder to keep relative paths stable.

Before the first startup after an update, create a backup of the existing database. For SQLite, confirm DB_DRIVER=sqlite and point BOUNCEBASH_DB_PATH at the existing file in the current shell or .env. Run npm.cmd run backup -- PATH_TO_NEW_BACKUP.sqlite. The command opens the existing file read-only and refuses an existing output file. For PostgreSQL, take and verify a provider snapshot or pg_dump before startup. Leave the original data and configuration in place when extracting the release.

Run python scripts/package-release.py PATH_OUTSIDE_THE_APP.zip to create a Windows-compatible update archive. The output must be a new file. The operation checks all admin hashes and excludes environment files, database files and installed dependencies.

### Email bridge and serverless scheduling

Configure PUBLIC_URL to the canonical HTTPS origin. Set NOTIFICATION_WEBHOOK_URL to a trusted HTTPS endpoint and NOTIFICATION_WEBHOOK_KEY to its private bearer token. Locally, a loopback HTTP bridge can capture synthetic messages. The bridge accepts a JSON POST containing id, recipient, kind and message data, sometimes including url. Return 2xx only after durable acceptance, apply Idempotency-Key to deduplicate, and treat all payloads as private. The worker sends no redirects, times out each request after ten seconds, retries with backoff and stops after eight failed attempts. Staff can inspect the delivery status without retrieving the private message body.

Run npm.cmd run outbox -- preflight to validate the configuration without opening a database or making a network request. A fresh local install with no bridge reports it as unconfigured. An isolated loopback capture is exercised by the account and browser tests.

Vercel invokes GET /api/cron/notifications every five minutes using its CRON_SECRET bearer credential. Store it only as a server-side environment variable and use a distinct value of at least 32 characters. This interval requires a plan that supports sub-daily execution. For a host without that support, remove the Vercel cron entry from that deployment configuration and schedule the same authenticated GET through an external scheduler every five minutes. Persistent Node deployments also have an in-process outbox timer. Verify the scheduled invocation and link delivery against an isolated hosted environment before enabling customer email. [Vercel cron guide](https://vercel.com/kb/guide/ship-a-express-app-on-vercel)

### Isolated remote PostgreSQL and Edge browser checks

For remote verification, provision a disposable TLS-enabled database with _test or -test in its name and no bouncebash schema. Set BOUNCEBASH_TEST_DATABASE_URL from your private environment and run node scripts/verify-remote-postgres.js --confirm-disposable. If using a private certificate authority, load DATABASE_CA_CERT privately. The smoke command installs the schema into that disposable database and leaves it available for inspection. It verifies TLS, the migration version, the active-date index and audit protection with a rolled-back synthetic transaction. npm.cmd run test:postgres still runs embedded PGlite.

With Microsoft Edge installed, install the optional browser tooling outside the application and run the browser script:

```powershell
npm.cmd install --prefix "$env:TEMP/bouncebash-browser-tools" --no-save --ignore-scripts playwright
$env:BOUNCEBASH_PLAYWRIGHT_MODULE = "$env:TEMP/bouncebash-browser-tools/node_modules/playwright"
node scripts/browser-smoke.cjs
```

The browser script uses synthetic accounts, a disposable SQLite file and a local capture bridge. Set BOUNCEBASH_BROWSER_CHANNEL=chrome to use installed Chrome. It leaves application dependencies unchanged.

## Shared Admin and customer site

Open /Bouncebash_Admin/login.html on the same application origin as the customer site and use an existing staff account. The dashboard, booking queue, calendar, reports, rental catalog, article editor, review moderation, and business settings use the shared backend. Existing bookings and transaction references appear without an import step.

Before updating an existing SQLite installation, keep the existing .env and confirm the resolved database path. With the server stopped, set the same SQLite path and run the corrected read-only backup before starting the updated application:

```powershell
$env:DB_DRIVER = 'sqlite'
$env:BOUNCEBASH_DB_PATH = 'PATH_TO_EXISTING_BOUNCEBASH.sqlite'
npm.cmd run backup -- 'PATH_TO_NEW_BACKUP.sqlite'
npm.cmd run migrate
npm.cmd start
```

Use `npm.cmd run migrate` only after verifying the backup and configured target. It creates the shared content and configuration tables and imports the seven bundled legacy article records without replacing subsequent edits. Use the same server and database for both sites. Live email and remote PostgreSQL setup remain under **Windows updates and operational verification**. See ADMIN_CS_INTEGRATION_REPORT.md for metric definitions, coverage and limitations.
