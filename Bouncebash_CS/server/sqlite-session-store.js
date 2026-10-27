const session = require('express-session');

class SqliteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.read = db.prepare('SELECT sess FROM web_sessions WHERE sid = ? AND expires_at > ?');
    this.write = db.prepare(`INSERT INTO web_sessions (sid, sess, expires_at) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at`);
    this.remove = db.prepare('DELETE FROM web_sessions WHERE sid = ?');
    this.cleanup = db.prepare('DELETE FROM web_sessions WHERE expires_at <= ?');
  }

  get(sid, callback) {
    try {
      this.cleanup.run(Date.now());
      const row = this.read.get(sid, Date.now());
      callback(null, row ? JSON.parse(row.sess) : null);
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sess, callback = () => {}) {
    try {
      const expiresAt = sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 86400000;
      this.write.run(sid, JSON.stringify(sess), expiresAt);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.remove.run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, sess, callback = () => {}) {
    this.set(sid, sess, callback);
  }
}

module.exports = { SqliteSessionStore };