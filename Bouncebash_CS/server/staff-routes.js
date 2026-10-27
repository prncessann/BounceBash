const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { passwordSchema } = require('./validation');

const staffLoginSchema = z.object({
  email: z.email().trim().max(254),
  password: passwordSchema(1)
});

function staffView(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

function requireStaff(db, roles = null) {
  return (req, res, next) => {
    const staffId = req.session.staffId;
    if (!staffId) return res.status(401).json({ error: 'Staff sign-in is required.' });
    const staff = db.prepare(`SELECT id, name, email, role, active, session_version
      FROM staff_users WHERE id = ?`).get(staffId);
    if (!staff || !staff.active || staff.session_version !== (req.session.staffVersion ?? 0)) {
      return req.session.destroy(() => res.status(401).json({ error: 'Staff sign-in is required.' }));
    }
    if (roles && !roles.includes(staff.role)) return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    req.staff = staff;
    next();
  };
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function catalogView(row) {
  const item = { ...row };
  if ('price_cents' in item) {
    item.priceCents = item.price_cents;
    delete item.price_cents;
  }
  if ('active' in item) item.active = Boolean(item.active);
  return item;
}

function registerStaffRoutes(app, db, { authLimiter, bookingSelect, bookingView, enqueueEmail }) {
  const signedIn = requireStaff(db);
  const adminOnly = requireStaff(db, ['admin']);
  const staffBookingSelect = bookingSelect
    .replace('SELECT b.*,', 'SELECT b.*, c.name AS customer_name, c.email AS customer_email, c.contact AS customer_contact,')
    .replace('FROM bookings b', 'FROM bookings b JOIN customers c ON c.id = b.customer_id');

  app.post('/api/staff/auth/login', authLimiter, async (req, res, next) => {
    const parsed = staffLoginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Please enter a valid email and password.' });
    try {
      const staff = db.prepare('SELECT * FROM staff_users WHERE email = ? COLLATE NOCASE').get(parsed.data.email);
      if (!staff?.active || !(await bcrypt.compare(parsed.data.password, staff.password_hash))) {
        return res.status(401).json({ error: 'Email or password is incorrect.' });
      }
      req.session.regenerate(error => {
        if (error) return next(error);
        req.session.staffId = staff.id;
        req.session.staffVersion = staff.session_version;
        req.session.cookie.maxAge = 60 * 60 * 1000;
        req.session.save(saveError => {
          if (saveError) return next(saveError);
          res.json({ staff: staffView(staff) });
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/staff/auth/me', signedIn, (req, res) => res.json({ staff: staffView(req.staff) }));

  app.post('/api/staff/auth/password', signedIn, authLimiter, async (req, res, next) => {
    const parsed = z.object({
      currentPassword: z.string().min(1).max(72),
      newPassword: passwordSchema(14)
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Provide your current password and a valid new password.' });
    try {
      const current = db.prepare('SELECT password_hash FROM staff_users WHERE id = ?').get(req.staff.id);
      if (!(await bcrypt.compare(parsed.data.currentPassword, current.password_hash))) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }
      const hash = await bcrypt.hash(parsed.data.newPassword, 12);
      db.prepare('UPDATE staff_users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?')
        .run(hash, req.staff.id);
      req.session.destroy(error => {
        if (error) return next(error);
        res.clearCookie('bouncebash.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
        res.json({ message: 'Password changed. Please sign in again.' });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/staff/auth/logout', signedIn, (req, res, next) => {
    req.session.destroy(error => {
      if (error) return next(error);
      res.clearCookie('bouncebash.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
      res.status(204).end();
    });
  });

  app.get('/api/staff/users', adminOnly, (_req, res) => {
    const users = db.prepare(`SELECT id, name, email, role, active, created_at AS createdAt
      FROM staff_users ORDER BY id`).all();
    res.json({ staff: users });
  });

  app.post('/api/staff/users', adminOnly, authLimiter, async (req, res, next) => {
    const parsed = z.object({
      name: z.string().trim().min(2).max(100),
      email: z.email().trim().max(254),
      password: passwordSchema(14),
      role: z.enum(['admin', 'manager'])
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Staff account details are invalid.' });
    try {
      const passwordHash = await bcrypt.hash(parsed.data.password, 12);
      const result = db.prepare(`INSERT INTO staff_users (name, email, password_hash, role)
        VALUES (?, ?, ?, ?)`).run(parsed.data.name, parsed.data.email.toLowerCase(), passwordHash, parsed.data.role);
      res.status(201).json({
        staff: { id: Number(result.lastInsertRowid), name: parsed.data.name, email: parsed.data.email.toLowerCase(), role: parsed.data.role }
      });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'A staff account with that email already exists.' });
      next(error);
    }
  });

  app.get('/api/staff/bookings', signedIn, (req, res) => {
    const filters = z.object({
      status: z.enum(['pending', 'confirmed', 'rejected', 'cancelled', 'completed']).optional(),
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
      q: z.string().trim().max(100).optional(),
      page: z.coerce.number().int().min(1).max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50)
    }).safeParse(req.query);
    if (!filters.success) return res.status(400).json({ error: 'Booking filters are invalid.' });
    const { status, from, to, q, page, limit } = filters.data;
    if (from && to && from > to) return res.status(400).json({ error: 'The date range is invalid.' });
    const conditions = [];
    const values = [];
    if (status) { conditions.push('b.status = ?'); values.push(status); }
    if (from) { conditions.push('b.event_date >= ?'); values.push(from); }
    if (to) { conditions.push('b.event_date <= ?'); values.push(to); }
    if (q) {
      conditions.push(`(c.name LIKE ? ESCAPE '\\' OR c.email LIKE ? ESCAPE '\\' OR c.contact LIKE ? ESCAPE '\\' OR CAST(b.id AS TEXT) = ?)`);
      const term = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      values.push(term, term, term, q);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`${staffBookingSelect}
      ${where} ORDER BY b.event_date DESC, b.id DESC LIMIT ? OFFSET ?`).all(...values, limit, (page - 1) * limit);
    res.json({
      bookings: rows.map(row => ({ ...bookingView(row), customer: { id: row.customer_id, name: row.customer_name, email: row.customer_email, contact: row.customer_contact } })),
      page,
      limit
    });
  });

  app.get('/api/staff/bookings/:id', signedIn, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(404).json({ error: 'Booking not found.' });
    const row = db.prepare(`${staffBookingSelect} WHERE b.id = ?`).get(id);
    if (!row) return res.status(404).json({ error: 'Booking not found.' });
    const events = db.prepare(`SELECT e.actor_type AS actorType, e.actor_id AS actorId,
      COALESCE(s.name, c.name) AS actorName, e.previous_status AS previousStatus, e.new_status AS newStatus,
      e.note, e.created_at AS createdAt FROM booking_events e
      LEFT JOIN staff_users s ON e.actor_type = 'staff' AND s.id = e.actor_id
      LEFT JOIN customers c ON e.actor_type = 'customer' AND c.id = e.actor_id
      WHERE e.booking_id = ? ORDER BY e.id`).all(id);
    res.json({
      booking: { ...bookingView(row), customer: { id: row.customer_id, name: row.customer_name, email: row.customer_email, contact: row.customer_contact } },
      events
    });
  });

  app.patch('/api/staff/bookings/:id/status', signedIn, (req, res, next) => {
    const id = Number(req.params.id);
    const parsed = z.object({
      status: z.enum(['confirmed', 'rejected', 'cancelled', 'completed']),
      note: z.string().trim().max(1000).default('')
    }).safeParse(req.body);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(404).json({ error: 'Booking not found.' });
    if (!parsed.success) return res.status(400).json({ error: 'A valid status and optional note are required.' });
    const transitions = {
      pending: ['confirmed', 'rejected', 'cancelled'],
      confirmed: ['cancelled', 'completed'],
      rejected: [],
      cancelled: [],
      completed: []
    };
    try {
      const update = db.transaction(() => {
        const row = db.prepare('SELECT status, customer_id FROM bookings WHERE id = ?').get(id);
        if (!row) return { missing: true };
        if (!transitions[row.status].includes(parsed.data.status)) return { conflict: true };
        db.prepare('UPDATE bookings SET status = ? WHERE id = ? AND status = ?').run(parsed.data.status, id, row.status);
        db.prepare(`INSERT INTO booking_events (booking_id, actor_type, actor_id, previous_status, new_status, note)
          VALUES (?, 'staff', ?, ?, ?, ?)`).run(id, req.staff.id, row.status, parsed.data.status, parsed.data.note);
        const customer = db.prepare('SELECT email, name FROM customers WHERE id = ?').get(row.customer_id);
        if (customer) enqueueEmail(db, {
          to: customer.email,
          subject: `Bounce Bash booking ${parsed.data.status}`,
          text: `Hello ${customer.name}, your booking request #${id} is now ${parsed.data.status}.`
        });
        return {};
      }).immediate();
      if (update.missing) return res.status(404).json({ error: 'Booking not found.' });
      if (update.conflict) return res.status(409).json({ error: 'That booking status transition is not allowed.' });
      const row = db.prepare(`${bookingSelect} WHERE b.id = ?`).get(id);
      res.json({ booking: bookingView(row) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/staff/feedback', signedIn, (req, res) => {
    const status = req.query.status;
    if (status !== undefined && !['pending', 'approved', 'rejected', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Feedback status is invalid.' });
    }
    const rows = status
      ? db.prepare(`SELECT f.*, p.name AS package_name FROM customer_feedback f JOIN packages p ON p.id = f.package_id
        WHERE f.status = ? ORDER BY f.created_at DESC LIMIT 200`).all(status)
      : db.prepare(`SELECT f.*, p.name AS package_name FROM customer_feedback f JOIN packages p ON p.id = f.package_id
        ORDER BY f.created_at DESC LIMIT 200`).all();
    res.json({ feedback: rows });
  });

  app.patch('/api/staff/feedback/:id', signedIn, (req, res) => {
    const id = Number(req.params.id);
    const parsed = z.object({ status: z.enum(['approved', 'rejected', 'resolved']) }).safeParse(req.body);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(404).json({ error: 'Feedback not found.' });
    if (!parsed.success) return res.status(400).json({ error: 'Feedback status is invalid.' });
    const result = parsed.data.status === 'resolved'
      ? db.prepare(`UPDATE customer_feedback SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status != 'resolved'`).run(id)
      : db.prepare('UPDATE customer_feedback SET status = ?, resolved_at = NULL WHERE id = ?').run(parsed.data.status, id);
    if (!result.changes) return res.status(404).json({ error: 'Feedback not found or already resolved.' });
    res.json({ feedback: db.prepare('SELECT * FROM customer_feedback WHERE id = ?').get(id) });
  });

  app.get('/api/staff/newsletter', signedIn, (req, res) => {
    if (req.query.format === 'csv') {
      const rows = db.prepare(`SELECT email, subscribed_at AS subscribedAt FROM newsletter_subscriptions
        WHERE active = 1 ORDER BY subscribed_at DESC`).all();
      res.type('text/csv').attachment('bouncebash-newsletter-subscribers.csv')
        .send(['email,subscribedAt', ...rows.map(row =>
          [row.email, row.subscribedAt].map(csvCell).join(',')
        )].join('\r\n'));
      return;
    }
    const rows = db.prepare(`SELECT id, email, subscribed_at AS subscribedAt, consent_at AS consentAt, active
      FROM newsletter_subscriptions ORDER BY subscribed_at DESC LIMIT 500`).all();
    res.json({ subscribers: rows });
  });

  app.get('/api/staff/catalog', adminOnly, (_req, res) => {
    res.json({
      packages: db.prepare('SELECT id, name, description, price_cents AS priceCents, active FROM packages ORDER BY name').all().map(row => ({ ...row, active: Boolean(row.active) })),
      models: db.prepare('SELECT id, name, description, capacity, active FROM inflatable_models ORDER BY name').all().map(row => ({ ...row, active: Boolean(row.active) })),
      addons: db.prepare('SELECT id, name, price_cents AS priceCents, active FROM addons ORDER BY name').all().map(row => ({ ...row, active: Boolean(row.active) }))
    });
  });

  const catalogTypes = {
    packages: {
      table: 'packages',
      create: z.object({ id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), name: z.string().trim().min(2).max(100), description: z.string().trim().min(2).max(500), priceCents: z.number().int().min(0).max(100000000) }),
      patch: z.object({ name: z.string().trim().min(2).max(100).optional(), description: z.string().trim().min(2).max(500).optional(), priceCents: z.number().int().min(0).max(100000000).optional(), active: z.boolean().optional() })
    },
    models: {
      table: 'inflatable_models',
      create: z.object({ id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), name: z.string().trim().min(2).max(100), description: z.string().trim().min(2).max(500), capacity: z.number().int().min(1).max(1000) }),
      patch: z.object({ name: z.string().trim().min(2).max(100).optional(), description: z.string().trim().min(2).max(500).optional(), capacity: z.number().int().min(1).max(1000).optional(), active: z.boolean().optional() })
    },
    addons: {
      table: 'addons',
      create: z.object({ id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), name: z.string().trim().min(2).max(100), priceCents: z.number().int().min(0).max(100000000) }),
      patch: z.object({ name: z.string().trim().min(2).max(100).optional(), priceCents: z.number().int().min(0).max(100000000).optional(), active: z.boolean().optional() })
    }
  };

  app.post('/api/staff/catalog/:type', adminOnly, (req, res, next) => {
    const catalog = catalogTypes[req.params.type];
    if (!catalog) return res.status(404).json({ error: 'Catalog type not found.' });
    const parsed = catalog.create.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Catalog item details are invalid.' });
    const fields = { ...parsed.data };
    if ('priceCents' in fields) { fields.price_cents = fields.priceCents; delete fields.priceCents; }
    const columns = Object.keys(fields);
    try {
      db.prepare(`INSERT INTO ${catalog.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
        .run(...columns.map(column => fields[column]));
      const item = db.prepare(`SELECT * FROM ${catalog.table} WHERE id = ?`).get(parsed.data.id);
      res.status(201).json({ item: catalogView(item) });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        return res.status(409).json({ error: 'A catalog item with that ID or name already exists.' });
      }
      next(error);
    }
  });

  app.patch('/api/staff/catalog/:type/:id', adminOnly, (req, res, next) => {
    const catalog = catalogTypes[req.params.type];
    if (!catalog) return res.status(404).json({ error: 'Catalog type not found.' });
    const parsed = catalog.patch.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data || {}).length === 0) return res.status(400).json({ error: 'Catalog changes are invalid.' });
    const fields = { ...parsed.data };
    if ('priceCents' in fields) { fields.price_cents = fields.priceCents; delete fields.priceCents; }
    for (const [field, value] of Object.entries(fields)) if (field === 'active') fields[field] = value ? 1 : 0;
    const columns = Object.keys(fields);
    try {
      const result = db.prepare(`UPDATE ${catalog.table} SET ${columns.map(column => `${column} = ?`).join(', ')} WHERE id = ?`)
        .run(...columns.map(column => fields[column]), req.params.id);
      if (!result.changes) return res.status(404).json({ error: 'Catalog item not found.' });
      res.json({ item: catalogView(db.prepare(`SELECT * FROM ${catalog.table} WHERE id = ?`).get(req.params.id)) });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'A catalog item with that name already exists.' });
      next(error);
    }
  });

  app.delete('/api/staff/catalog/:type/:id', adminOnly, (req, res) => {
    const catalog = catalogTypes[req.params.type];
    if (!catalog) return res.status(404).json({ error: 'Catalog type not found.' });
    const result = db.prepare(`UPDATE ${catalog.table} SET active = 0 WHERE id = ?`).run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Catalog item not found.' });
    res.status(204).end();
  });

}

module.exports = { registerStaffRoutes };
