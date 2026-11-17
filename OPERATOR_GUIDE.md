# Operator API guide

Keep `OPERATOR_API_KEY` private. Start the application before using the CLI. Paths below are relative to `/api/operator`. Reads use GET; writes use POST or PUT and a JSON object. `npm run operator -- METHOD PATH JSON` reads the key from `.env`. For complex bodies or Windows shell quoting, save JSON to a file and use `--body-file` as illustrated below.

```sh
npm run operator -- PUT /catalog/packages/1/pricing --body-file package-price.json
```

The file must contain approved business data, for example this **format** (replace the amounts/details before using it for actual customers):

```json
{"price":"4500.00","hours":4,"inclusions":["Approved inclusion"],"modelIds":[1]}
```

Do not run example prices/model IDs without first configuring and checking the real catalog. `GET /catalog` shows IDs and existing data; `GET /bookings`, `/inquiries`, `/reviews`, `/date-blocks`, `/notifications` and `/audit` show operational queues.

| Operation | Method and path | JSON body |
| --- | --- | --- |
| Add package | POST `/catalog/packages` | `name`, optional `description` |
| Add add-on | POST `/catalog/add-ons` | `name`, optional `description` |
| Create rental model | POST `/catalog/models` | `zoneId`, `name`, `capacity`, optional `description`, `imageUrl` under `/assets/photos/` |
| Activate/deactivate model | PUT `/catalog/models/:id` | `active`, `capacity` |
| Create model variant | POST `/catalog/variants` | `modelId`, `name` |
| Activate/deactivate variant | PUT `/catalog/variants/:id` | `active` |
| Create ball/decor option | POST `/catalog/options` | `addOnId`, `name` |
| Activate/deactivate option | PUT `/catalog/options/:id` | `active` |
| Set package pricing/compatibility | PUT `/catalog/packages/:id/pricing` | `price` (PHP decimal), `hours`, `inclusions` array, `modelIds` array |
| Set add-on pricing/quantity limit | PUT `/catalog/add-ons/:id/pricing` | `price` (zero allowed for an included option), `maxQuantity` |
| Activate/deactivate package or add-on | PUT `/catalog/packages/:id` or `/catalog/add-ons/:id` | `active`, optional `description` |
| Reply to inquiry | POST `/inquiries/:id/reply` | `reply` |
| Convert inquiry once | POST `/inquiries/:id/convert` | `customerAcceptedFee: true` only after actual customer acknowledgement |
| Override booking quote | PUT `/bookings/:reference/quote` | `total` (PHP), mandatory `note` explaining adjustments |
| Booking transition | PUT `/bookings/:reference/status` | `status`: confirmed, completed or cancelled; cancellation also needs `reason` |
| Verify/reject reference | PUT `/payments/:id` | `status`: verified or rejected, plus `note` |
| Record an external refund | PUT `/payments/:id` | `status`: refunded and `note`; booking must first be cancelled/expired |
| Block an unoccupied date | POST `/date-blocks` | `date` (YYYY-MM-DD), `reason` |
| Remove block | POST `/date-blocks/:date/remove` | `{}` |
| Moderate review | PUT `/reviews/:id` | `status`: approved, rejected or pending |
| Report | GET `/reports?from=YYYY-MM-DD&to=YYYY-MM-DD` | none |
| Run expiry/delivery batch | POST `/maintenance` | `{}` |
| Retry failed notification | POST `/notifications/:id/retry` | `{}` |

Booking lists accept `status`, `from`, `to`, `limit` and `offset`. Inquiry lists accept `status` (new/replied/converted), `limit` and `offset`. The public catalog excludes inactive data. No customer can call these staff operations using an ordinary login cookie.

A booking can be confirmed only with a quote and a verified 50% deposit. Future events cannot be marked completed; completion also requires full verified payment. A customer-submitted reference is pending until staff checks the real transaction/receipt outside this website. Refund recording never sends money. Audit records describe who performed operational actions and cannot be edited or deleted by normal application SQL.

Report date bases are explicit in each response: bookings use event date; payment amounts use the payment record's creation date (UTC). Pending/rejected payments are not collected revenue; refunded rows are separate. Outstanding totals cover active bookings in the selected event-date range. Reports show current operational state, not historical financial statements or an audited accounting ledger.
