const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const packages = [
  ['little-bounce', 'Little Bounce', 'A single bounce house for a smaller celebration.', 450000],
  ['ball-pit-bash', 'Ball Pit Bash', 'A ball pit for toddlers and little ones to play in.', 550000],
  ['bash-and-bounce', 'Bash & Bounce', 'A bounce house and ball pit together for a fuller party.', 850000],
  ['the-luxe-bash', 'The Luxe Bash', 'A complete setup with balloon decor included.', 1250000]
];

const models = [
  ['classic-white-castle', 'Classic White Castle', 'All-white castle bounce house with a slide and ball pit.', 10],
  ['boho-pastel-playground', 'Boho Pastel Playground', 'Cream-toned playground with slide, climbing wall and tunnel.', 12],
  ['rainbow-racer-slide', 'Rainbow Racer Slide', 'Bright slide combo with a bouncy play area.', 12],
  ['carnival-pop-castle', 'Carnival Pop Castle', 'Multicolor castle with obstacle tunnels and ball pit.', 12]
];

const addons = [
  ['ball-colors', 'Ball colors', 0],
  ['balloon-garland', 'Balloon garland', 250000],
  ['balloon-arch', 'Balloon arch', 350000],
  ['backdrop-signage', 'Backdrop & signage', 280000],
  ['table-styling', 'Table styling', 180000],
  ['extra-hour', 'Extra hour', 0]
];

const baseSchema = `
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    contact TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS inflatable_models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS addons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    package_id TEXT NOT NULL REFERENCES packages(id),
    model_id TEXT NOT NULL REFERENCES inflatable_models(id),
    event_date TEXT NOT NULL,
    event_time TEXT NOT NULL,
    venue TEXT NOT NULL,
    children_count INTEGER NOT NULL CHECK (children_count BETWEEN 1 AND 1000),
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
    idempotency_key TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (customer_id, idempotency_key)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS one_active_booking_per_model_date
    ON bookings(model_id, event_date) WHERE status IN ('pending', 'confirmed');
  CREATE INDEX IF NOT EXISTS bookings_customer_date ON bookings(customer_id, event_date);
  CREATE TABLE IF NOT EXISTS booking_addons (
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    addon_id TEXT NOT NULL REFERENCES addons(id),
    PRIMARY KEY (booking_id, addon_id)
  );
  CREATE TABLE IF NOT EXISTS web_sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS web_sessions_expiry ON web_sessions(expires_at);
  CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    subscribed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS customer_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    package_id TEXT NOT NULL REFERENCES packages(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    message TEXT NOT NULL,
    publish_consent INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

function hasColumn(db, table, column) {
  return db.pragma(`table_info(${table})`).some(item => item.name === column);
}

function addColumn(db, table, column, definition) {
  if (!hasColumn(db, table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function migrateBookings(db) {
  const definition = `CREATE TABLE bookings_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    package_id TEXT NOT NULL REFERENCES packages(id),
    model_id TEXT NOT NULL REFERENCES inflatable_models(id),
    event_date TEXT NOT NULL,
    event_time TEXT NOT NULL,
    venue TEXT NOT NULL,
    children_count INTEGER NOT NULL CHECK (children_count BETWEEN 1 AND 1000),
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'completed')),
    total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
    idempotency_key TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (customer_id, idempotency_key)
  )`;

  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec(definition);
      db.exec(`INSERT INTO bookings_new
        (id, customer_id, package_id, model_id, event_date, event_time, venue, children_count, notes, status, total_cents, idempotency_key, created_at)
        SELECT id, customer_id, package_id, model_id, event_date, event_time, venue, children_count, notes, status, total_cents, idempotency_key, created_at FROM bookings`);
      db.exec('DROP TABLE bookings; ALTER TABLE bookings_new RENAME TO bookings;');
      db.exec(`CREATE UNIQUE INDEX one_active_booking_per_model_date
        ON bookings(model_id, event_date) WHERE status IN ('pending', 'confirmed');
        CREATE INDEX bookings_customer_date ON bookings(customer_id, event_date);`);
    }).immediate();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function migrateFeedback(db) {
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec(`CREATE TABLE customer_feedback_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        event_type TEXT NOT NULL,
        package_id TEXT NOT NULL REFERENCES packages(id),
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        message TEXT NOT NULL,
        publish_consent INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'resolved')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TEXT
      )`);
      db.exec(`INSERT INTO customer_feedback_new
        (id, name, event_type, package_id, rating, message, publish_consent, status, created_at)
        SELECT id, name, event_type, package_id, rating, message, publish_consent, status, created_at FROM customer_feedback`);
      db.exec('DROP TABLE customer_feedback; ALTER TABLE customer_feedback_new RENAME TO customer_feedback;');
    }).immediate();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

const migrations = [
  {
    version: 1,
    apply(db) {
      db.exec(baseSchema);
    }
  },
  {
    version: 2,
    apply(db) {
      migrateBookings(db);
      migrateFeedback(db);
      addColumn(db, 'customers', 'active', 'INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))');
      addColumn(db, 'customers', 'email_verified', 'INTEGER NOT NULL DEFAULT 1 CHECK (email_verified IN (0, 1))');
      addColumn(db, 'customers', 'session_version', 'INTEGER NOT NULL DEFAULT 0');
      addColumn(db, 'newsletter_subscriptions', 'active', 'INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))');
      addColumn(db, 'newsletter_subscriptions', 'consent_at', 'TEXT');
      addColumn(db, 'customer_feedback', 'resolved_at', 'TEXT');
      db.exec('UPDATE newsletter_subscriptions SET consent_at = subscribed_at WHERE consent_at IS NULL');
      db.exec(`
        CREATE TABLE staff_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'manager')),
          active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
          session_version INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE booking_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          booking_id INTEGER NOT NULL REFERENCES bookings(id),
          actor_type TEXT NOT NULL CHECK (actor_type IN ('customer', 'staff', 'system')),
          actor_id INTEGER,
          previous_status TEXT,
          new_status TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX booking_events_booking ON booking_events(booking_id, id);
        CREATE TABLE customer_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          purpose TEXT NOT NULL CHECK (purpose IN ('password_reset', 'email_verification', 'email_change')),
          token_hash TEXT NOT NULL UNIQUE,
          data TEXT,
          expires_at INTEGER NOT NULL,
          used_at INTEGER,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX customer_tokens_expiry ON customer_tokens(expires_at);
        CREATE TABLE newsletter_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subscription_id INTEGER NOT NULL REFERENCES newsletter_subscriptions(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at INTEGER NOT NULL,
          used_at INTEGER,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX newsletter_tokens_expiry ON newsletter_tokens(expires_at);
        CREATE TABLE email_outbox (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recipient TEXT NOT NULL,
          subject TEXT NOT NULL,
          text_body TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
          attempts INTEGER NOT NULL DEFAULT 0,
          next_attempt_at INTEGER NOT NULL,
          locked_at INTEGER,
          last_error TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          sent_at TEXT
        );
        CREATE INDEX email_outbox_pending ON email_outbox(status, next_attempt_at);
        CREATE TABLE payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          booking_id INTEGER NOT NULL REFERENCES bookings(id),
          provider TEXT NOT NULL,
          provider_reference TEXT,
          amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
          status TEXT NOT NULL CHECK (status IN ('pending', 'authorized', 'paid', 'failed', 'partially_refunded', 'refunded')),
          currency TEXT NOT NULL DEFAULT 'PHP',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX payments_booking ON payments(booking_id, id);
        CREATE UNIQUE INDEX payments_provider_reference
          ON payments(provider, provider_reference) WHERE provider_reference IS NOT NULL;
        CREATE TABLE payment_webhook_events (
          provider TEXT NOT NULL,
          event_id TEXT NOT NULL,
          received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          processed_at TEXT,
          status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
          PRIMARY KEY (provider, event_id)
        );
      `);
    }
  },
  {
    version: 3,
    apply(db) {
      addColumn(db, 'email_outbox', 'locked_at', 'INTEGER');
    }
  },
  {
    version: 4,
    apply(db) {
      addColumn(db, 'bookings', 'package_name_snapshot', 'TEXT');
      addColumn(db, 'bookings', 'package_price_cents_snapshot', 'INTEGER');
      addColumn(db, 'bookings', 'model_name_snapshot', 'TEXT');
      addColumn(db, 'booking_addons', 'name_snapshot', 'TEXT');
      addColumn(db, 'booking_addons', 'price_cents_snapshot', 'INTEGER');
      db.exec(`UPDATE bookings SET
        package_name_snapshot = COALESCE(package_name_snapshot, (SELECT name FROM packages WHERE id = bookings.package_id)),
        package_price_cents_snapshot = COALESCE(package_price_cents_snapshot, (SELECT price_cents FROM packages WHERE id = bookings.package_id)),
        model_name_snapshot = COALESCE(model_name_snapshot, (SELECT name FROM inflatable_models WHERE id = bookings.model_id));
        UPDATE booking_addons SET
          name_snapshot = COALESCE(name_snapshot, (SELECT name FROM addons WHERE id = booking_addons.addon_id)),
          price_cents_snapshot = COALESCE(price_cents_snapshot, (SELECT price_cents FROM addons WHERE id = booking_addons.addon_id));`);
    }
  }
];

function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map(row => row.version));
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    const rebuildsTables = migration.version === 2;
    if (rebuildsTables) db.pragma('foreign_keys = OFF');
    try {
      db.transaction(() => {
        migration.apply(db);
        db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(migration.version);
      }).immediate();
    } finally {
      if (rebuildsTables) db.pragma('foreign_keys = ON');
    }
  }
  const foreignKeyErrors = db.pragma('foreign_key_check');
  if (foreignKeyErrors.length) throw new Error('Database migration produced foreign-key violations.');
}

function createDatabase(databasePath = './data/bouncebash.sqlite') {
  const resolvedPath = path.resolve(databasePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const db = new Database(resolvedPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  migrate(db);

  const seed = db.transaction(() => {
    const insertPackage = db.prepare('INSERT OR IGNORE INTO packages (id, name, description, price_cents) VALUES (?, ?, ?, ?)');
    packages.forEach(row => insertPackage.run(...row));
    const insertModel = db.prepare('INSERT OR IGNORE INTO inflatable_models (id, name, description, capacity) VALUES (?, ?, ?, ?)');
    models.forEach(row => insertModel.run(...row));
    const insertAddon = db.prepare('INSERT OR IGNORE INTO addons (id, name, price_cents) VALUES (?, ?, ?)');
    addons.forEach(row => insertAddon.run(...row));
  });
  seed();
  return db;
}

module.exports = { createDatabase };
