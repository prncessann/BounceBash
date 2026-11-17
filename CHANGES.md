# Completed changes from BounceBash(3).zip

## Repaired the interrupted update

- Fixed the startup-breaking `staticRoot` references and replaced root-wide static serving with explicit public mounts.
- Connected actual phone/time/type/length validation and origin protections to requests.
- Replaced the unused, spoofable in-memory limiter with atomic database-backed limits. Untrusted `X-Forwarded-For` is ignored unless a trusted proxy is explicitly configured.
- Preserved the latest upload's configurable database path, original data file, customer-account behavior and isolated test baseline.

## Completed backend and customer integration

- Added the inquiry, catalog relationship/variant, pricing, booking lifecycle, payment verification, date blocking, reporting, audit and notification schemas/services.
- Added private guest tracking, rescheduling/cancellation, explicit quote/deposit/balance rules, payment-reference submission and protected operational actions.
- Added verification, secure email changes, expiring single-use recovery, old-session revocation and unsubscribe flows.
- Added safe dynamic catalog/booking selection, quote preview, inquiry mode, management/account-help pages and inquiry history; refreshed the booking mini-calendar after submissions.
- Made unconfigured prices, inclusions, durations and options visible as requiring confirmation instead of publishing sample prices as approved business rates.
- Added PostgreSQL/Supabase migrations, a read-only SQLite import with destination guards, a shared serverless handler, explicit public build, Vercel configuration, local setup/start scripts, operator commands, delivery inspection and backup tooling.
- Expanded integration tests across SQLite and embedded PostgreSQL; added real-script DOM integration, transaction/backup/import checks and admin hashes.

## Preserved boundaries

Every one of the 11 files under `Bouncebash_Admin/` is byte-for-byte unchanged from the latest uploaded ZIP. The supplied SQLite file is also preserved byte-for-byte in this package. Tests never inserted their fixtures into that file. On first run, normal additive migrations upgrade a working copy and invalidate old plaintext sessions once.

The original static admin panel has not been wired to these APIs. Use the protected operator CLI for management until admin integration is separately authorized.

## External and business setup

No Supabase/Vercel account, live deployment, payment account or email provider was created or contacted. Configure approved catalog data and provider/database/domain credentials using README.md and OPERATOR_GUIDE.md. Payment references and refund statuses record manually verified external transactions; the website does not charge or refund money automatically.

Current capacity remains one active booking per date, preserving the prior behavior; the documented hold timeout is configurable. Staff must handle payments associated with expired/cancelled bookings. See README.md for the exact workflow and operating policies.
