# BounceBash Admin and customer-site integration

## What changed

The seven staff pages share the operational database with the customer site. The original sidebar, navigation, typefaces, colors and brand assets remain. Sample tables, counters, calendar entries, report charts, placeholder settings and static status chips were removed from the admin HTML. The replacement pages use the existing card, button, grid and table styles. Refresh displays the local time of the last successful fetch in Philippine time. A failed request leaves an explicit error and labels any retained results as previous results.

| Tab or control | Endpoint | Shared database source and visible effect |
| --- | --- | --- |
| Dashboard totals, upcoming events, recent activity and refresh | `GET /api/operator/overview`, `GET /api/operator/audit` | Bookings, payment states and immutable audit events |
| Booking list, reference search, status/payment filters, sorting, pages and detail | `GET /api/operator/bookings`, `GET /api/operator/bookings/:reference` | Booking snapshots, customer contact, expiry, payments and attachments |
| Staff entry, quote, confirmation, completion, cancellation and reschedule | `POST /api/operator/bookings`, booking `quote`, `status` and `reschedule` routes | Shared booking transaction and date checks. Staff-entered bookings have no customer association. Inquiry conversion uses only the stored customer ID |
| Payment verification, rejection and recording an external refund | `PUT /api/operator/payments/:id`; protected proof download | Existing payment transitions and financial history. The owner sees changes in Manage Booking |
| Inquiries, reply and conversion | `GET /api/operator/inquiries`, inquiry `reply` and `convert` | Inquiry records stay separate from bookings. Only conversion creates a hold |
| Calendar, navigation, date selection and blocking | `GET /api/availability/month`, booking date-range query, date-block routes | Same calendar availability and date blocks as CS. Conflict checks run within write transactions |
| Reports, period presets, date/status filters, CSV and Print to PDF | `GET /api/operator/overview`, compatibility `GET /api/operator/reports` | Both reports share an underlying calculation. The browser exports the current result. Print to PDF is provided by the browser |
| Package offers, duration, inclusions, active state, compatible models, photos and variants | Operator catalog routes and `GET /api/catalog` | Existing offer, model and relationship tables. Customer catalog and quotes use the stored offer |
| Applicable extras and 17 delivery rates | `PUT /api/operator/pricing-policy` | Stored policy supplies public rate labels and server calculations |
| Articles, new drafts, edit, publish, unpublish and archive | Operator article routes, `GET /api/articles`, `GET /api/articles/:slug` | Imported legacy articles and staff drafts in the same table |
| Review moderation, feature status, editorial notes and archive | Operator review routes, `GET /api/reviews` | Original reviews and a separate editorial row. Rating summaries and public lists exclude archived or ineligible reviews |
| Contact and payment settings, booking rules display and notification retry | Operator business settings, public business settings, personal staff notification preferences and existing outbox routes | Persisted public contact details and approved payment instructions. Server booking rules remain in force |

Staff browsers authenticate with same-origin session cookies. The existing staff schema uses a single staff access level. Existing operator CLI credentials remain supported server-side. Operator changes initiated by staff record the staff ID in audit records. Existing booking ownership and payment-state checks remain in place. The UI makes no financial transfer.

## Migration and pricing

`backend/site-content.js` initializes three additive tables, `blog_articles`, `business_configuration` and `review_editorial`, on SQLite or PostgreSQL. PostgreSQL enables row-level security on these tables. Server startup and `npm.cmd run migrate` run the same idempotent initializer. Existing booking, staff, customer, payment, quotation and attachment tables are preserved. The separate importer into an empty PostgreSQL destination includes staff accounts and the three new tables. Sessions remain excluded from that migration. It imports seven previously published CS articles from the bundled article pages. Stable slugs retain existing URLs. Publication labels preserve source precision, including month-only dates. Original article formatting is carried as allowlisted DOM structures. Staff replacement bodies are plain text. Article edits use optimistic revisions. Archived and draft articles no longer return public content. The previous customer testimonial and feedback containers already used the review API, so the migration imported zero static testimonials. Existing database review rows retain their original text and consent.

The school-demo rental packages remain at four hours and ₱6,500 / ₱5,500 / ₱7,500 / ₱4,500 / ₱3,500. The policy row starts with the previous effective defaults for arch, backdrop, extra hours and NCR delivery. The packaged database had no recorded centavo values for those three in-scope legacy add-on rows. The old fee fields are preserved. It is inserted only when absent. Ineligible add-ons and per-child charges stay outside the quote calculation. Existing package and historical snapshot records are untouched at migration. Customer review gets a price fingerprint and booking creation recalculates from current server records inside the booking transaction. A stale fingerprint returns a conflict, updates the displayed review and requires deposit acknowledgement again. Older API callers can submit without a fingerprint and still receive server-calculated prices.

The former 11 static sample booking references matched zero rows in the packaged operational SQLite file. That aggregate read used a read-only connection. Stored demo data was not classified as fabricated or deleted. The packaged file hash matched the previous audit. No operational migration was applied.

## Financial definitions and reconciliation

- Booking counts, known booking values and receivables use event date and the selected current booking state. Upcoming counts require an active booking with an event date and time in the future in Manila.
- Receivables include only pending or confirmed bookings with a known total. They are the stored total minus verified payments, floored at zero. Pending references do not reduce that balance. Unknown quotes are counted separately.
- Payment period selection uses the original receipt timestamp converted to Philippine date boundaries. Amounts reflect current verification and refund state. Net verified collections equal payments currently verified. Gross recorded collections add back externally recorded refunded amounts. Rejected and pending references are excluded from collections. This is an operational current-state calculation, and it does not reconstruct daily historical settlement events.
- Unresolved inactive funds are pending plus verified amounts on cancelled or expired bookings in the selected event-date range. Refunded and rejected rows remain in history and do not enter unresolved totals.
- The isolated integration created a synthetic pending payment, verified it, reconciled owner balance against staff collections, cancelled the booking, and recorded an external refund. Gross and recorded refund both reached ₱3,500, net returned to zero, and the original payment remained recorded.

## Verification

| Command | Result |
| --- | --- |
| Baseline SQLite run before integration | 82 passed, 0 failed |
| `npm.cmd test -- --serial` with SQLite | 84 passed and 0 failed. After the final catalog eligibility change, the targeted wizard rerun passed 13 checks. |
| `npm.cmd run test:postgres` | 84 passed and 0 failed with embedded PGlite. Real remote PostgreSQL remains unverified. |
| `node --test test/admin-integration.test.js` on SQLite and PGlite | Two passed per adapter. Covers staff authorization, shared booking and payment workflow, calendar conflicts, stale price protection, financial reconciliation, staff notice queuing and reminder deduplication, legacy import and restart persistence |
| `node scripts/admin-browser-smoke.cjs` | Passed in Edge at 1440, 768 and 390 pixels. Staff sign-in, all seven tabs, quote, payment verification, calendar, staff entry without customer association, both CSV contents, Print invocation, article editing, settings, and empty and failed report refreshes were exercised. |
| `node scripts/browser-smoke.cjs` | Passed in Edge at 1440, 768 and 390 pixels. Covered the customer workflow and 27 viewport/page checks, including active Manage Booking. |
| `npm.cmd audit --json --fetch-retries=0` | Passed. Zero advisories reported across 161 dependencies |
| `npm.cmd run build` and `python scripts/package-release.py` with a new temporary archive path | Passed. Public assets built, current admin files verified in the archive, environment files and operational databases excluded |

The targeted `node --test test/database.test.js` run passed 9 checks, including read-only backup verification and import of staff and configuration records into an empty embedded PostgreSQL destination.

## Windows update

Preserve the existing `.env`. Identify the existing SQLite file from startup diagnostics, stop the server, and set the same path in PowerShell. Run `npm.cmd run backup -- 'PATH_TO_NEW_BACKUP.sqlite'`, verify that backup, then run `npm.cmd run migrate` and `npm.cmd start`. Open `/Bouncebash_Admin/login.html` and the customer site on the same origin. For existing PostgreSQL deployments, verify a private provider backup before migration. Neither deployment nor an operational database migration was performed during this task.

## Changed files

- Admin pages `index.html`, `bookings.html`, `calendar.html`, `reports.html`, `packages.html`, `blog.html`, `settings.html`, `login.html`, plus `styles.css` and `admin-operational.js`.
- Customer `index.html`, `blog.html`, `article.html`, `5-neutral-party-themes-that-photograph-beautifully.html`, `a-day-with-our-delivery-and-setup-crew.html`, `ball-pit-color-combinations-that-always-look-good.html`, `complete-guide-stress-free-kids-party.html`, `indoor-or-outdoor-choosing-the-best-space.html`, `our-setup-checklist-before-the-first-bounce.html`, `pick-the-right-inflatable-for-your-guest-list.html`, `blog-content.js`, `booking.html`, `booking-wizard.js`, `customer-tools.js` and `site.js`.
- `server.js`, `backend/booking-rules.js`, `backend/site-content.js`, `backend/operator-overview.js`, `backend/staff-notices.js`, `backend/legacy-articles.json`, `scripts/migrate.js`, `scripts/migrate-sqlite.js`, `scripts/package-release.py`, `scripts/admin-browser-smoke.cjs`, `test/admin-integration.test.js`, `test/database.test.js`, `test/booking.test.js`, `README.md` and this report.

## Remaining verification and constraints

- Remote PostgreSQL, hosted routing, deployment, real email and real payments were deferred. Tests used disposable databases, a local email capture and synthetic references.
- The staff browser smoke test exercises the main actions. Exhaustive validation-branch coverage, weekly summary delivery on a hosted Monday schedule, and physical printer or PDF file output remain unverified.
- The existing booking/calendar date range and review/inquiry loading limits still bound what staff can view in a single request.
- Production payment receiving details still require business confirmation. Publishing contact or payment instructions does not verify account ownership.

