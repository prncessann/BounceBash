# Bounce Bash PH – Admin Panel

Plain HTML and CSS only. No JavaScript.

## Files
- `index.html` – Dashboard
- `bookings.html`, `calendar.html`, `reports.html`, `packages.html`, `blog.html`, `settings.html`
- `styles.css` – all styling (shared by every page)
- `assets/` – images (`logo-full.png` is the logo used in the sidebar)

## Logo
Put your logo in `assets/` and replace `logo-full.png` (or keep the file name, or change the `src` of the `<img class="logo-img">` in each page).
Recommended: a transparent PNG or SVG, about 440 x 92 px.

## What still works without JavaScript
- Click a booking ID to open its details panel; click Close or the dark area to close it
- Bookings page: filter by payment status
- Calendar page: click a date to see its bookings

Buttons that need a database or scripting (recording payments, exporting CSV, forms) were removed.
