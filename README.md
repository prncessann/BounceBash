# Bounce Bash PH

Static customer and admin pages for Bounce Bash PH.

## Project layout

```text
.
├── index.html              # Redirects the site root to the customer website
├── assets/
│   ├── logo/
│   └── photos/
├── Bouncebash_CS/          # Customer website HTML and style.css
└── Bouncebash_Admin/       # Admin panel HTML, styles.css, and its own assets/
```

The customer website uses the shared `../assets/` directory. The admin panel keeps its logo assets in `Bouncebash_Admin/assets/`.

## Pages

- Customer website: open `Bouncebash_CS/index.html`
- Admin panel: open `Bouncebash_Admin/index.html`

The pages are static prototypes. Customer account, booking, and other form submissions are not connected to a backend.

## GitHub Pages

The root `index.html` redirects visitors to the customer website.

Live site: https://cessann00.github.io/BounceBash/
