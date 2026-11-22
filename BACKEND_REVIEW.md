# Final customer backend and controls review

## Findings fixed in this release

1. **Shared submission limit blocked legitimate customer actions.** Quotes, booking reads and booking writes previously shared 20 requests per IP per 15 minutes. Editing a booking could consume the quota before payment or reschedule. Quotes now have a separate 120/minute budget; owner reads have 120/minute; authenticated booking writes have a separate 30/15-minute budget per customer. Existing authentication and anonymous-submission protections remain. Existing .env files need no manual modification.
2. **Manage Booking appeared unresponsive.** Success/error text appeared at the top of a long page. Both forms now show feedback directly beside their controls, plus notifications. Busy states disable repeat submission; validation marks invalid fields; an unchanged schedule explains what must change. The ₱2,499.99 payment scenario was exercised against a real temporary backend database.
3. **Gallery and FAQ scripts conflicted with the security policy.** Inline behavior scripts were moved to external files allowed by the existing script-src self policy. Gallery filters, Load more and FAQ search now have functional DOM regression tests.
4. **Legacy variant names contained the removed word.** Customer catalog/quote labels clean legacy “(sample)” suffixes without rewriting historical stored data. New variant names and booking copy no longer include the word.
5. **Other customer controls needed consistency.** Feedback now loads the current catalog instead of only the legacy package list. Month/filter requests reject stale responses. Unconfigured empty social links are removed rather than acting as dead controls. FAQ instructions now match three-hour holds, final-price deposits and NCR delivery charges.

## Verified controls and behavior

| Customer control | Verification |
| --- | --- |
| Rental/zone/style selection, Continue and Back | DOM wizard with real catalog; values retained; incompatible/missing selections rejected |
| Arch color count, arch quantity, backdrop event/Other, ball colors | Conditional fields, maximum three distinct colors and server-calculated prices |
| Review booking, deposit acknowledgement, Submit booking | Real backend submission; breakdown in final step; no right sidebar |
| Request reschedule | Page button updates date/time in database, releases old day, reserves new day and retains payments |
| Submit for verification | Page button records payment cents/reference; pending history; duplicate reference feedback; repeat-click protection |
| Profile Cancel booking | Pending and paid active bookings; reason dialog; cancellation retains payment records |
| Print receipt | Verified payments only; invokes browser print; no pending payments included |
| Login, Sign up | Form/API wiring, valid and invalid credentials, HTTP-only session cookies |
| Save profile, Change email, Update password, Resend verification | Form wiring plus backend persistence/password checks/session revocation |
| Forgot password, reset, verify, unsubscribe | Correct form routes; one-use recovery/verification tokens and isolated notification bridge |
| Newsletter subscription | Submit, duplicate rejection and unsubscribe |
| Feedback, review filters and Load More Reviews | Submit/moderation/public-consent checks; filters/pagination; safe text rendering |
| Calendar previous/next, mouse and keyboard date selection | Navigation and booking link state; unavailable-date and expiry backend checks |
| Gallery filters and Load more | External script under current security policy; filter-specific visibility |
| FAQ search | Matches, empty state and reset |
| Mobile navigation menu | Opens, closes with Escape and closes on link selection |
| Local page/image/script links | All customer HTML pages scanned; local targets exist; unique element IDs |
| Sign out | Backend destroys session; existing frontend handler retained |

## Backend coverage

The passing suites cover SQLite and PostgreSQL-compatible migrations; schema integrity; transaction/savepoint rollback; foreign keys; audit immutability; owner/staff authorization; rate limits; private-file protection; origin checks; JSON validation; exact price/deposit calculations; notes quotations; conflicting bookings; pending hold expiry; confirmed-booking protection; late payment verification; cancellation/payment retention; account recovery; notification delivery through a local test bridge; feedback moderation; newsletter and subscription cancellation.

`TEST_LOCAL.log` and `TEST_POSTGRES.log` are the actual current runs. See TEST_RESULTS.md for counts and limitations. Historical superseded guest-token/OCR test sources are retained as reference text and are not counted as current passes. All 15 supplied admin files remain unchanged; their existing authenticated booking API session was tested. The admin screen design was not modified.

## Remaining configuration and verification

No additional blocker was found in the customer flows exercised by these tests. This does not establish that every possible browser, device, race condition or production deployment is defect-free.

- **Real email delivery:** configure the trusted notification bridge URL/key. Tests used an isolated local bridge; no real email was sent. Without credentials, delivery remains queued.
- **Payments:** manual verification is the agreed design. Entering a reference does not verify a transfer or charge money. Staff must check the real transaction. Confirm the supplied receiving account/QR code with the business before live use; refunds remain external/manual.
- **Approved catalog/contact details:** demo rates are the user's requested synthetic defaults. Real equipment, supervision, public contact details and production offers require business approval. Removing presentation wording does not turn demonstration data into verified inventory.
- **Production database/hosting:** PostgreSQL syntax and migrations were tested in PGlite, not against a remote production server. Real credentials, TLS, backups, routing, notification retries with the actual provider and deployment-specific behavior still need verification in that deployment.
- **Visual browser testing:** Chromium cannot start in this environment. DOM/button behavior, CSS parsing/intrinsic shrink rules, links and assets were checked, but no desktop/mobile screenshot, pixel-perfect layout or physical assistive-device pass is claimed.
- **Windows/long-running capacity:** the Windows launcher is included, but Windows installation and production soak/capacity tests were not executed here. Parallel catalog smoke checks are not a production capacity rating.

## Installing the complete update

Stop the previously running BounceBash server, extract the ZIP into your existing BounceBash folder and replace program files, then double-click START_WINDOWS.bat. The ZIP contains no private .env or live database, so existing settings/accounts/bookings are not overwritten by extraction. A fresh installation creates missing local settings and its database automatically. Restarting is necessary so Node loads the updated backend, including the new request limits.
