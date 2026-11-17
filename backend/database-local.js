'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const dbPath = path.resolve(process.env.BOUNCEBASH_DB_PATH || process.env.DB_PATH || path.join(__dirname, '..', 'data', 'bouncebash.sqlite'));
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
function seedCatalog() {
  const packageRows = [
    ['Little Bounce', 'Best for smaller birthday groups and easy setup.', 0],
    ['Ball Pit Bash', 'A soft pastel ball pit setup for toddlers and young kids.', 0],
    ['Bash & Bounce', 'A versatile bounce zone with extra party energy.', 0],
    ['The Luxe Bash', 'Premium décor-forward package with elevated styling.', 0],
  ];

  const addonRows = [
    'Ball colors',
    'Balloon garland',
    'Balloon arch',
    'Backdrop & signage',
    'Table styling',
    'Extra hour',
  ];

  const insertPackage = db.prepare(`INSERT OR IGNORE INTO packages (name, description, base_price) VALUES (?, ?, ?)`);
  for (const [name, description, price] of packageRows) {
    insertPackage.run(name, description, price);
  }

  const insertAddon = db.prepare(`INSERT OR IGNORE INTO add_ons (name) VALUES (?)`);
  for (const name of addonRows) {
    insertAddon.run(name);
  }
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone TEXT,
      city TEXT,
      address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      base_price REAL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS add_ons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      reference_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT NOT NULL,
      venue TEXT NOT NULL,
      package_name TEXT NOT NULL,
      children_count INTEGER NOT NULL,
      selected_style TEXT,
      add_ons TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      reservation_fee_accepted INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS booking_add_ons (
      booking_id INTEGER NOT NULL,
      add_on_id INTEGER NOT NULL,
      PRIMARY KEY(booking_id, add_on_id),
      FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      FOREIGN KEY(add_on_id) REFERENCES add_ons(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      event_type TEXT,
      package_name TEXT,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      message TEXT NOT NULL,
      can_feature INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const bookingColumns = db.pragma('table_info(bookings)');
  if (!bookingColumns.some((column) => column.name === 'selected_style')) {
    db.exec('ALTER TABLE bookings ADD COLUMN selected_style TEXT');
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(event_date);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at);`);

  seedCatalog();
}

initDatabase();

// Additive migrations preserve existing records. Never edit the shipped admin files.
function addColumn(table, name, definition) {
  if (!db.pragma(`table_info(${table})`).some(row => row.name === name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}
db.transaction(() => {
  addColumn('customers', 'email_verified', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('bookings', 'email', "TEXT NOT NULL DEFAULT ''");
  addColumn('bookings', 'access_token_hash', 'TEXT');
  addColumn('bookings', 'expires_at', 'TEXT');
  addColumn('bookings', 'total_cents', 'INTEGER');
  addColumn('bookings', 'deposit_cents', 'INTEGER');
  addColumn('bookings', 'cancellation_reason', "TEXT NOT NULL DEFAULT ''");
  addColumn('reviews', 'moderation_status', "TEXT NOT NULL DEFAULT 'pending'");
  addColumn('newsletter_subscribers', 'unsubscribe_hash', 'TEXT');
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS account_tokens (
      id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('reset','verify')), token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY, booking_id INTEGER NOT NULL REFERENCES bookings(id),
      amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
      reference TEXT NOT NULL COLLATE NOCASE UNIQUE, method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected','refunded')),
      review_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY, recipient TEXT NOT NULL, kind TEXT NOT NULL,
      payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sent_at TEXT, last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_pending ON notifications(status, next_attempt_at);
    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL,
      entity TEXT NOT NULL, entity_id TEXT NOT NULL, detail TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_events
    BEGIN SELECT RAISE(ABORT, 'Audit records cannot be edited'); END;
    CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_events
    BEGIN SELECT RAISE(ABORT, 'Audit records cannot be deleted'); END;
    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
    );
  `);
  if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = 2').get()) {
    // Old plaintext session cookies are invalidated once when installing this version.
    db.prepare('DELETE FROM sessions').run();
    db.prepare('INSERT INTO schema_migrations(version) VALUES (2)').run();
  }
  addColumn('packages', 'base_price_cents', 'INTEGER');
  addColumn('packages', 'rental_hours', 'INTEGER');
  addColumn('packages', 'inclusions', "TEXT NOT NULL DEFAULT '[]'");
  addColumn('add_ons', 'unit_price_cents', 'INTEGER');
  addColumn('add_ons', 'max_quantity', 'INTEGER NOT NULL DEFAULT 20');
  addColumn('bookings', 'model_id', 'INTEGER REFERENCES rental_models(id)');
  addColumn('bookings', 'variant_id', 'INTEGER REFERENCES model_variants(id)');
  addColumn('bookings', 'selection_json', "TEXT NOT NULL DEFAULT '{}'" );
  addColumn('bookings', 'quote_json', 'TEXT');
  db.exec(`
    CREATE TABLE IF NOT EXISTS rental_zones(id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rental_models(id INTEGER PRIMARY KEY, zone_id INTEGER NOT NULL REFERENCES rental_zones(id), name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '', capacity INTEGER NOT NULL CHECK(capacity>0), image_url TEXT NOT NULL DEFAULT '', is_active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS model_variants(id INTEGER PRIMARY KEY, model_id INTEGER NOT NULL REFERENCES rental_models(id), name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1, UNIQUE(model_id,name));
    CREATE TABLE IF NOT EXISTS package_models(package_id INTEGER NOT NULL REFERENCES packages(id),model_id INTEGER NOT NULL REFERENCES rental_models(id),PRIMARY KEY(package_id,model_id));
    CREATE TABLE IF NOT EXISTS add_on_options(id INTEGER PRIMARY KEY,add_on_id INTEGER NOT NULL REFERENCES add_ons(id),name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,UNIQUE(add_on_id,name));
    CREATE TABLE IF NOT EXISTS inquiries(id INTEGER PRIMARY KEY,customer_id INTEGER REFERENCES customers(id),name TEXT NOT NULL,email TEXT NOT NULL DEFAULT '',contact TEXT NOT NULL,
      details TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','replied','converted')),
      reply TEXT NOT NULL DEFAULT '', booking_id INTEGER UNIQUE REFERENCES bookings(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS date_blocks(event_date TEXT PRIMARY KEY,reason TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
  `);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_active_booking_date ON bookings(event_date) WHERE status IN ('pending','confirmed','completed')");
  const insertZone=db.prepare('INSERT OR IGNORE INTO rental_zones(slug,name) VALUES (?,?)');
  for(const row of [['dry','Dry Zone'],['splash','Splash Zone'],['ball-pit','Ball Pit Zone']])insertZone.run(...row);
})();
function audit(actor, action, entity, id, detail = {}) {
  db.prepare('INSERT INTO audit_events(actor, action, entity, entity_id, detail) VALUES (?,?,?,?,?)')
    .run(actor, action, entity, String(id), JSON.stringify(detail));
}
module.exports = { db, dbPath, audit };
