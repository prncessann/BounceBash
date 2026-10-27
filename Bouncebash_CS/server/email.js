const nodemailer = require('nodemailer');

const smtp = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER,
  password: process.env.SMTP_PASSWORD,
  from: process.env.SMTP_FROM
};

const configuredFields = [smtp.host, smtp.user, smtp.password, smtp.from].filter(Boolean).length;
if (configuredFields !== 0 && configuredFields !== 4) {
  throw new Error('SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM must be configured together.');
}

if (smtp.host && (!Number.isInteger(smtp.port) || smtp.port < 1 || smtp.port > 65535)) {
  throw new Error('SMTP_PORT must be a valid TCP port.');
}

const transport = smtp.host ? nodemailer.createTransport({
  host: smtp.host,
  port: smtp.port,
  secure: smtp.secure,
  auth: { user: smtp.user, pass: smtp.password },
  disableFileAccess: true,
  disableUrlAccess: true
}) : null;

function isConfigured() {
  return transport !== null;
}

async function sendEmail({ to, subject, text, messageId }) {
  if (!transport) {
    const error = new Error('Email delivery is not configured.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }
  await transport.sendMail({ from: smtp.from, to, subject, text, ...(messageId ? { messageId } : {}) });
}

async function processOutbox(db, send = sendEmail) {
  const record = db.transaction(() => {
    const now = Date.now();
    db.prepare(`UPDATE email_outbox SET status = 'failed', locked_at = NULL, next_attempt_at = ?
      WHERE status = 'sending' AND locked_at < ?`).run(now, now - 5 * 60 * 1000);
    const row = db.prepare(`SELECT id, recipient, subject, text_body, attempts FROM email_outbox
      WHERE status IN ('pending', 'failed') AND next_attempt_at <= ? ORDER BY id LIMIT 1`).get(now);
    if (!row) return null;
    db.prepare(`UPDATE email_outbox SET status = 'sending', attempts = attempts + 1, locked_at = ? WHERE id = ?`).run(now, row.id);
    return row;
  }).immediate();
  if (!record) return;

  try {
    await send({
      to: record.recipient,
      subject: record.subject,
      text: record.text_body,
      messageId: `<bouncebash-outbox-${record.id}@bouncebash.local>`
    });
    db.prepare(`UPDATE email_outbox SET status = 'sent', sent_at = CURRENT_TIMESTAMP, last_error = NULL, locked_at = NULL WHERE id = ?`).run(record.id);
  } catch (error) {
    const attempts = record.attempts + 1;
    const delay = Math.min(24 * 60 * 60 * 1000, 60 * 1000 * (2 ** Math.min(attempts, 10)));
    db.prepare(`UPDATE email_outbox SET status = 'failed', next_attempt_at = ?, last_error = ?, locked_at = NULL WHERE id = ?`)
      .run(Date.now() + delay, error.code || 'DELIVERY_FAILED', record.id);
  }
}

async function deliverOutbox(db) {
  if (!transport || process.env.NODE_ENV === 'test') return;
  return processOutbox(db);
}

function enqueueEmail(db, { to, subject, text }) {
  db.prepare(`INSERT INTO email_outbox (recipient, subject, text_body, next_attempt_at)
    VALUES (?, ?, ?, ?)`).run(to, subject, text, Date.now());
}

module.exports = { deliverOutbox, enqueueEmail, isConfigured, processOutbox, sendEmail };
