const router = require('express').Router();
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');
const db     = require('../config/database');
const { ok, badRequest, notFound, serverError } = require('../helpers/response');

// Tout ce module est réservé à l'admin — équivalent d'un "phpMyAdmin" pour la base SQLite.
router.use(auth, roles('admin'));

// ── GET /api/db-admin/tables — liste des tables + nombre de lignes ─────
router.get('/tables', async (req, res) => {
  try {
    const [tables] = await db.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    );
    const withCounts = [];
    for (const t of tables) {
      try {
        const [[row]] = await db.execute(`SELECT COUNT(*) AS n FROM "${t.name}"`);
        withCounts.push({ name: t.name, count: row.n });
      } catch (_) {
        withCounts.push({ name: t.name, count: null });
      }
    }
    ok(res, withCounts);
  } catch (err) { serverError(res, err); }
});

// ── GET /api/db-admin/tables/:name — colonnes + lignes paginées ────────
router.get('/tables/:name', async (req, res) => {
  const name = req.params.name;
  try {
    const [tableCheck] = await db.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`, [name]
    );
    if (!tableCheck.length) return notFound(res, 'Table introuvable');

    const [cols] = await db.execute(`PRAGMA table_info("${name}")`);
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [[{ n: total }]] = await db.execute(`SELECT COUNT(*) AS n FROM "${name}"`);
    const [rows] = await db.execute(`SELECT * FROM "${name}" LIMIT ? OFFSET ?`, [limit, offset]);

    ok(res, {
      columns: cols.map(c => c.name),
      rows, total, page, limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) { serverError(res, err); }
});

// ── POST /api/db-admin/query — lecture seule (SELECT / WITH uniquement) ─
// Volontairement en LECTURE SEULE : aucune modification/suppression de données n'est
// possible depuis cette console, même par un admin, pour éviter qu'une requête destructrice
// (DROP/DELETE/UPDATE sans WHERE...) ne soit exécutée par erreur sur l'app déployée.
router.post('/query', async (req, res) => {
  const { sql } = req.body;
  if (!sql || !sql.trim()) return badRequest(res, 'Requête SQL requise');
  const upper = sql.trim().toUpperCase();
  const isReadOnly = upper.startsWith('SELECT') || upper.startsWith('WITH') || upper.startsWith('PRAGMA TABLE_INFO');
  if (!isReadOnly) {
    return badRequest(res, "Seules les requêtes SELECT (lecture) sont autorisées ici. Pour modifier des données, utilisez l'interface habituelle de l'application.");
  }
  try {
    const [rows] = await db.execute(sql);
    ok(res, { rows, rowCount: rows.length });
  } catch (err) {
    badRequest(res, err.message);
  }
});

module.exports = router;
