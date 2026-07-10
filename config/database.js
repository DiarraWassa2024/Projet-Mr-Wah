const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'gpo.db'), {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
});
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Adaptateur qui imite l'API mysql2 (await db.execute(sql, params))
const pool = {
  execute: (sql, params = []) => {
    try {
      const stmt = db.prepare(sql);
      const upper = sql.trim().toUpperCase();
      if (upper.startsWith('SELECT') || upper.startsWith('PRAGMA') || upper.startsWith('WITH')) {
        const rows = stmt.all(...(Array.isArray(params) ? params : [params]));
        return Promise.resolve([rows]);
      } else {
        const info = stmt.run(...(Array.isArray(params) ? params : [params]));
        return Promise.resolve([{ insertId: info.lastInsertRowid, affectedRows: info.changes }]);
      }
    } catch (err) {
      return Promise.reject(err);
    }
  },
  raw: db, // accès direct si besoin
};

module.exports = pool;
