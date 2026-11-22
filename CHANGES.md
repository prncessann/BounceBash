# Customer booking release changes

- Four-step photo-based rental wizard, synthetic style/color examples, persistent drafts, red required-field validation and clear Back/Continue/Review controls.
- Server-enforced item/variant compatibility, 17 NCR delivery choices, fixed delivery fees, ₱600 additional hours and no per-child charge.
- Free ball-color dropdown, ₱400 arches with 1–3 colors and quantity, ₱800 event backdrops with Other text; removed table styling and balloon garland for new requests.
- Final total for empty notes; pending admin quotation and blocked payment for nonempty notes. Original price components remain preserved after quotation.
- Signed-in owner booking/profile management; removed guest tracking codes and customer payment proof/OCR UI. Kept authenticated historical proof access and verified-payment print summary.
- Immediate whole-date hold, three-hour server expiry and owner countdown. Public calendar displays Unavailable. Expiry/cancellation retain payment records and late verification never reactivates a date.
- SQLite and PostgreSQL schema migration 4, additive demo bootstrap and current regression tests. Historical superseded test sources retained under tests/superseded for reference.
- All uploaded admin files and the existing database are unchanged. Secret environment files, dependencies, Git metadata and temporary response dumps are excluded from the release ZIP.

## Customer layout refinement

- Moved the price breakdown to final review; removed the sidebar and requested caption.
- Fixed intrinsic fieldset/grid sizing, consistent card gaps and mobile tracks across the customer stylesheet.
- Removed the large cancellation form from Manage Booking; added a compact profile action beneath status for active bookings, including paid bookings, with an accessible reason dialog.
- All admin files and the existing database remain unchanged.

## Automatic local setup

This ZIP omits private .env and live database files, preserving existing installations during extraction. START_WINDOWS.bat creates missing settings, installs missing dependencies and launches the server. New installations create their database automatically.

## Final customer controls fix

- Separated price-preview/read quotas from authenticated booking writes; existing .env files need no changes.
- Added adjacent success/error feedback, field validation and busy/duplicate-click protection to reschedule and payment forms.
- Removed sample wording from customer variant labels, including older stored catalog names.
- Externalized gallery/FAQ scripts for CSP compatibility; updated feedback catalog options and stale calendar/review response handling.
- Added full button/backend review and expanded regression suites; admin files remain unchanged.
