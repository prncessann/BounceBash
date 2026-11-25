'use strict';

const config = require('../backend/config');
if (config.production || (process.env.DB_DRIVER || (process.env.DATABASE_URL ? 'postgres' : 'sqlite')) !== 'sqlite') {
  throw new Error('Demo bookings can only be seeded into a local SQLite database.');
}
const { db: database } = require('../backend/database');
const { db } = require('../backend/database-local');
const { seedDemo } = require('../backend/demo-booking-catalog');

const dates = [
  '2026-08-26', '2026-08-29', '2026-09-02', '2026-09-05',
  '2026-09-09', '2026-09-13', '2026-09-19', '2026-09-23',
  '2026-09-26', '2026-09-30', '2026-10-04', '2026-10-08',
  '2026-10-11', '2026-10-17', '2026-10-21', '2026-10-24',
  '2026-10-28', '2026-11-01', '2026-11-04', '2026-11-07',
  '2026-11-11', '2026-11-15', '2026-11-21', '2026-11-24',
];

function shiftDate(day, offset) {
  const value = new Date(day + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

const seed = db.transaction(() => {
  const catalog = db.prepare(`
    SELECT m.id AS model, p.name AS package, p.base_price_cents AS total,
           v.id AS variant, v.name AS style
    FROM rental_models m
    JOIN packages p ON p.id = m.booking_package_id
    JOIN model_variants v ON v.id = (
      SELECT MIN(id) FROM model_variants WHERE model_id = m.id AND is_active = 1
    )
    WHERE m.is_active = 1 AND p.is_active = 1 AND m.is_demo = 1
    ORDER BY m.id
  `).all();
  if (!catalog.length) throw new Error('Enable DEMO_CATALOG to seed demo bookings.');

  const findReference = db.prepare('SELECT 1 FROM bookings WHERE reference_code = ?');
  const findDate = db.prepare('SELECT 1 FROM bookings WHERE event_date = ?');
  const insert = db.prepare(`
    INSERT INTO bookings (
      reference_code, name, contact_number, email, event_date, event_time, venue,
      package_name, selected_style, notes, reservation_fee_accepted, status,
      created_at, updated_at, expires_at, total_cents, deposit_cents,
      cancellation_reason, model_id, variant_id, subtotal_cents, delivery_fee_cents,
      pricing_state, flow_version
    ) VALUES (
      @reference, @name, '00000000000', @email, @day, @time, @venue, @package,
      @style, 'Synthetic historical booking for admin demonstration.', 1,
      @status, @created, @updated, @expires, @total, @deposit, @reason,
      @model, @variant, @total, 0, 'final', 2
    )
  `);

  const statuses = ['cancelled', 'completed', 'expired', 'completed'];
  const times = ['10:00', '13:00', '15:00'];
  const conflicts = [];
  let inserted = 0;
  let existing = 0;
  for (const [index, day] of dates.entries()) {
    const number = index + 1;
    const label = String(number).padStart(2, '0');
    const reference = 'DEMO-HIST-20261125-' + label;
    if (findReference.get(reference)) {
      existing++;
      continue;
    }
    if (findDate.get(day)) {
      conflicts.push(day);
      continue;
    }
    const rental = catalog[index % catalog.length];
    const status = statuses[number % statuses.length];
    const createdDay = shiftDate(day, -10 - (number % 8));
    const updatedDay = status === 'completed' ? day : shiftDate(createdDay, status === 'cancelled' ? 2 : 0);
    insert.run({
      ...rental,
      reference,
      name: 'Demo Customer ' + label,
      email: 'demo-' + label + '@example.invalid',
      day,
      time: times[number % times.length],
      venue: 'Demo Venue ' + (index % 6 + 1),
      status,
      created: createdDay + ' 02:00:00',
      updated: updatedDay + ' 05:00:00',
      expires: status === 'expired' ? createdDay + 'T05:00:00.000Z' : null,
      deposit: Math.floor(rental.total / 2),
      reason: status === 'cancelled' ? 'Synthetic cancellation' : '',
    });
    inserted++;
  }
  return { inserted, existing, conflicts };
});

async function main() {
  await database.ready;
  try {
    if (config.demoCatalog) await seedDemo(database);
    const { inserted, existing, conflicts } = seed.immediate();
    console.log(`Demo bookings added: ${inserted}. Already present: ${existing}.`);
    if (conflicts.length) console.log('Dates with existing bookings skipped: ' + conflicts.join(', '));
  } finally {
    await database.close();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
