# Booking release verification

Tested against the supplied BounceBash(4).zip source. Synthetic accounts, venues, transfers and future event dates were used in isolated temporary databases. Tests never contacted a real payment provider or added records to the shipped database.

| Check | Result |
| --- | --- |
| `npm test` (SQLite) | 77 passed, 0 failed, 0 skipped |
| `npm run test:postgres` (PGlite) | 77 passed, 0 failed, 0 skipped |
| JavaScript syntax | All shipped JavaScript files syntax checked |
| Public asset build | Passed |
| Dependency audit | 0 reported vulnerabilities at verification time |
| Original admin integrity | All 15 files unchanged, SHA-256 compared directly with uploaded ZIP |
| Original database integrity | Live database omitted from update ZIP to preserve installed bookings; copied uploaded database upgrade passed integrity and foreign-key checks |
| Demo seed | Repeated seed produced five records without overwriting operator pricing |
| Parallel read smoke check | 30 concurrent catalog reads completed without errors in each database test run; timings in logs |
| Chromium visual testing | Blocked: Chromium failed to start; no visual pass claimed |

The database-specific checks differ slightly between runs. Both drivers execute the booking, hold, migration and customer DOM suites. PGlite verifies PostgreSQL SQL/migration behavior but is not a live remote PostgreSQL/Supabase integration test.

## Functional coverage

- Item/variant compatibility; all five demo offers and 17 location fees; server-owned totals, deposit rounding, additional hours and no child charge.
- Free ball colors, rejection of ball quantities, 1–3 distinct arch colors and per-arch quantity pricing, fixed backdrop rates and required Other text.
- Empty versus nonempty notes, payment blocked until final quotation, unauthorized quote rejection, preserved original breakdown after approval.
- Sign-in before submission, owner isolation, automatic profile listing, guest-token rejection, valid staff-session access to existing operational APIs.
- Immediate availability blocking and concurrent double-booking prevention; three-hour server timestamps, expired-date release, confirmed-booking protection, retained payments and late staff verification without reactivating the date.
- Manual payment references, rejection of binary image submissions, deposit verification before confirmation, cancellation with retained funds, verified-only printable summary.
- Wizard photo cards, required-field errors, Back/Continue value preservation, arch/backdrop conditional fields, Back / Review, acknowledgement and full submission against a real test backend.
- Timer derives elapsed time from the server plus monotonic elapsed time, refresh/remount uses the original expiry, local wall-clock skew does not grant additional time.
- Removal of Styles navigation, private-code UI and receipt upload/OCR controls.

## Non-functional coverage

HTTP-only and SameSite session cookies; security headers; origin write protection; private file denial; JSON input type/size limits; separate-customer authorization; atomic booking contention; transaction/savepoint rollback; immutable audit data; backup reopen; SQLite foreign keys and schema upgrades; production HTTPS configuration; PostgreSQL row-level security; protected public build. The dependency audit is a package advisory snapshot, not a security certification or penetration test.

## Practical limits

No desktop/mobile screenshots or browser layout pass is claimed because Chromium could not start. DOM tests verify behavior, not pixel layout or assistive-device compatibility. Real Windows execution, real email delivery, real transfers, remote PostgreSQL networking/TLS, long-running soak testing and production capacity were not tested here. Confirm the supplied payment details, configure delivery credentials and approve real equipment/rates before live use. Demo rates and delivery zones are synthetic; they are not verified market prices.

Historical guest data remains staff-accessible. Live customer bookings require the signed-in owner; records are never assigned merely because a name/phone matches. The existing admin files are unchanged; new customer-only controls are enforced through shared backend rules and the existing quotation/payment endpoints.

The former guest-code, capacity-pricing and OCR tests are retained as reference text under `tests/superseded/`; they describe obsolete contracts and are not counted as current passing tests. Current logs are `TEST_LOCAL.log` and `TEST_POSTGRES.log`.

## Layout refinement regression checks

The updated DOM tests verify that pricing belongs to the final Review step, no wizard sidebar exists, the removed caption is absent, selected extras survive Review navigation, profile cancellation follows the status for both pending and paid active bookings, inactive bookings omit cancellation, and the reason dialog validates and posts the correct booking reference. Customer grid/fieldset CSS now explicitly permits shrinking and wrapping instead of intrinsic overflow. Visual desktop/mobile rendering remains unverified because of the previously documented Chromium startup restriction; no visual pass is claimed.

## Final button/backend regression

The final run adds real-page Manage Booking submissions at the normal anonymous-request limit, 30 quote previews before booking, repeated owner reads before rescheduling, the ₱2,499.99 payment scenario, nearby validation/server feedback and repeat-click protection. Customer forms, account recovery, moderation, notification bridge delivery, gallery/FAQ external-script behavior, calendar controls, review filters, mobile navigation and all local HTML targets were also checked. See BACKEND_REVIEW.md for the control matrix, fixed findings and remaining configuration/visual limits.
