const Database = require('better-sqlite3');
const path = require('path');

// DB_PATH permet de pointer vers un disque persistant en production (ex: Fly.io /data/gpo.db) —
// sans variable définie, comportement local inchangé (fichier gpo.db à la racine du projet).
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'gpo.db');

function openConnection() {
  const conn = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  });
  conn.pragma('journal_mode = WAL');
  conn.pragma('foreign_keys = ON');
  return conn;
}

// `db` est volontairement mutable (let, pas const) : après une restauration de sauvegarde
// (routes/sauvegarde.js), on remplace le fichier sur disque puis on appelle pool.reload()
// pour rouvrir une connexion propre sur le nouveau fichier — sans redémarrer tout le
// processus Node, et sans dépendre du comportement de redémarrage de l'hébergeur.
let db = openConnection();

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
  get raw() { return db; }, // toujours la connexion courante, même après reload()
  /** Ferme la connexion actuelle et en rouvre une nouvelle sur le même fichier (après restauration). */
  reload() {
    try { db.close(); } catch (_) {}
    db = openConnection();
  },
};

module.exports = pool;
