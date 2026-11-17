# Validation results

Validation date: 17 November 2026. Runtime: Node.js v24.22.1 on Linux.

## Executed successfully

| Check | Result |
| --- | --- |
| Clean dependency installation (`npm ci`) | Passed with the supplied lockfile; native SQLite dependency installed successfully |
| SQLite suite (`npm test`) | 113 passed, 0 failed |
| PostgreSQL suite (`npm run test:postgres`) | 112 passed, 0 failed using embedded PostgreSQL/PGlite |
| Customer DOM integration | Included in the suites; catalog, quotes, inquiry submission, guest tracking, cancellation and account-help paths passed |
| SQLite backup/reopen and integrity | Passed |
| SQLite-to-PostgreSQL import | Preserved synthetic legacy records and refused a replay into a populated destination |
| Concurrent requests for one date | Exactly one booking created; competing requests rejected |
| Expired pending hold | Released by the actual maintenance path using an isolated SQLite test fixture |
| Account and booking ownership | Unauthorized customer and guest access denied |
| Payment handling | Pending/verified balances, duplicate reference, overpayment, confirmation prerequisites and explicit refund recording passed |
| Notification behavior | Local fake provider, stable idempotency keys, token delivery and retained failures passed; no real outgoing email |
| Database transactions | Rollback and nested savepoints passed in both database modes |
| Audit immutability | Edit/delete rejection passed |
| PostgreSQL access schema | RLS enabled on application tables; elevated connection remains server-side |
| Origin, body, input and private-file protections | Tested malformed values/objects, oversized bodies, forbidden origins, exposed-file paths and unauthorized staff calls |
| Abuse limits | Excess requests returned 429; spoofed forwarded-IP header did not bypass limits |
| Production cookie configuration | HTTPS required and Secure cookies enabled |
| Production dependency audit (`npm audit --omit=dev`) | No known vulnerabilities reported by the registry at validation time; see DEPENDENCY_AUDIT.json |
| Public output build | Passed; backend source, database, configuration and tests excluded |
| Customer local resource references | No missing file targets found |
| Original admin files | All 11 files match the uploaded ZIP byte-for-byte |
| Supplied SQLite file | Preserved byte-for-byte; test fixtures used separate temporary databases |

Counts include Node's parent test entries and overlapping tests run in both modes. They are not counts of unique product features or a claim of complete production coverage. The extra SQLite case simulates expiry by changing an isolated test fixture's hold timestamp; PostgreSQL executes the shared maintenance/query code but does not repeat that direct SQLite fixture manipulation.

Full output is in `TEST_LOCAL.log` and `TEST_POSTGRES.log`. `TEST_PERFORMANCE.json` records the local read-only catalog probe: 100 requests at concurrency 10, no HTTP errors; median 6.34 ms, p95 8.19 ms, maximum 12.08 ms. These timings do not measure production capacity, provider latency or a sustained mixed workload.

## Not verified externally

- Actual Supabase account/connection, hosting migration, database network/TLS conditions and Vercel deployment were not exercised. No credentials or live project were supplied. PostgreSQL behavior was tested with a real embedded PostgreSQL engine, not a live Supabase service.
- No real payment transfer, refund or payment gateway was used. The implementation deliberately tracks manually verified external transactions.
- No real email/SMS provider was configured or contacted. The delivery contract and failure handling were tested against a local fake HTTP provider.
- DOM tests execute the real scripts but do not render screenshots or certify desktop/mobile layout, visual design, browser compatibility, Lighthouse scores, or accessibility. Full browser launch was restricted in this environment.
- A restore from the generated SQLite backup was reopened and checked; provider-level PostgreSQL disaster recovery and a production backup drill remain deployment responsibilities.

Approved prices, durations, models, capacities, variant/color options, provider credentials, deployment URL and a production database are operational configuration rather than values this update can safely invent. See README.md and OPERATOR_GUIDE.md.
