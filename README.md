# BounceBash

## Project Overview

BounceBash is a party-rental website for inflatables, ball pits, and event add-ons. Group 7, BSIS 3A, developed it for CC312-M Website Development at the Technological University of the Philippines – Manila under Prof. Mary Joy Viñas.

## Purpose

The site introduces BounceBash, shows examples of party setups, and answers common rental questions. It also includes customer booking and staff interface previews.

## Team Members & Roles

| Team member | Role |
| --- | --- |
| Delos Reyes, Princess Ann A. | Project Manager |
| Baniqued, Hazel D. | Developer |
| Cal, John Erick S. | Developer |
| Diaz, Ashley P. | UI/UX Designer and QA / Tester |
| Suarez, Allyson S. | Developer |

## Tools Used

- HTML, CSS, and vanilla JavaScript
- Visual Studio Code and Live Server for local preview
- Git and GitHub for version control
- GitHub Pages for static hosting
- Node.js and Express for the local API and SQLite for local storage

## Site Structure

```text
BounceBash/
├── index.html              Home page with About and Contact sections
├── rentals.html            Rental information
├── packages.html           Party packages
├── add-ons.html            Rental add-ons
├── gallery.html            Event photos
├── faq.html                Common questions
├── booking.html            Booking form preview
├── style.css               Root customer stylesheet
├── site.js                 Main customer script
├── js/                     Shared customer page scripts
├── server.js               Node.js web server and API
├── backend/                Database access and server-side services
├── migrations/             PostgreSQL schema migrations
├── scripts/                Local setup and database utilities
├── package.json            Node.js dependencies and commands
├── Bouncebash_CS/          Existing customer page URLs and stylesheet
├── Bouncebash_Admin/       Staff interface pages
│   ├── css/                Staff stylesheets
│   ├── js/                 Staff scripts
│   └── assets/             Staff branding
├── assets/
│   ├── logo/               Branding and social icons
│   ├── photos/             Rental and event photos
│   └── payments/           Payment display images
├── test/                   Browser-side checks with mocked API responses
├── CHANGES.md              Earlier release history
├── README.md
└── .gitignore
```

The PDF's example uses separate About, Services, and Contact pages. BounceBash puts About and Contact on the home page and uses Rentals, Packages, and Add-ons for its services. The existing main script is named `site.js`.

The Node.js server connects the customer and staff pages to the database for catalog data, availability, accounts, bookings, and staff operations. GitHub Pages serves the static preview. API-backed actions require the Node.js server.

## Design Concept

- **Color scheme.** Cream and sand backgrounds with mocha text and gold, blush, and sage accents.
- **Typography.** Cormorant Garamond for headings and Montserrat for body text.
- **Layout.** Responsive cards and grids organize the rental information and photos.

## Deployment

### Local site with SQLite

From the project folder in PowerShell, use Node.js 22.13 through 24.x and run:

```powershell
npm.cmd ci
npm.cmd run setup
npm.cmd start
```

Open [the customer site](http://localhost:3000/) or [staff sign-in](http://localhost:3000/Bouncebash_Admin/login.html). On Windows, `START_WINDOWS.bat` runs the same setup and start steps when needed.

SQLite opens `data/bouncebash.sqlite`, creating it if needed. A new local database starts with demo catalog data and uses the private settings in `.env`. To create a staff account, run `node scripts/create-staff.js <email> "<full name>" "<password>"` with a password of at least eight characters.

After setup, run `npm.cmd run seed:demo` to add 24 synthetic historical bookings to local SQLite. In Admin Bookings, search for `DEMO-HIST` or filter for August 25 through November 25, 2026. The command can run again safely and skips dates already occupied by another booking. Git shares the seed script while `data/bouncebash.sqlite` and `.env` stay local.

### Static preview and GitHub Pages

For a static local preview, serve `index.html` with Live Server.

For GitHub Pages, select the branch containing this structure and publish from its root. The root `index.html` is the customer entry point. Existing customer links under `Bouncebash_CS/` also resolve.

- [GitHub repository](https://github.com/prncessann/BounceBash)
- [Expected GitHub Pages URL](https://prncessann.github.io/BounceBash/) (deployment verification pending)

## Lessons Learned

Relative paths depend on where a page is served. The root and customer-folder pages share images and scripts while keeping their existing page URLs. Static hosting also makes it important to identify which browser interactions work independently and which forms and views need an API.

## Timeline

| Phase | Work | Status |
| --- | --- | --- |
| Proposal and design | Scope, wireframes, and visual direction | Completed |
| Development | Customer and staff pages, styling, and browser interactions | Source files available |
| Static release preparation | Organize the files and update the README | Completed November 25, 2026 |
| Deployment and submission | Verify GitHub Pages and capture submission screenshots | Pending |
