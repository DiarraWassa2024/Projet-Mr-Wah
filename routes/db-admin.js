const router = require('express').Router();
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');
const db     = require('../config/database');
const { ok, badRequest, notFound, serverError } = require('../helpers/response');

// Tout ce module est réservé à l'admin — équivalent d'un "phpMyAdmin" pour la base SQLite.
router.use(auth, roles('admin'));

// La liste des tables n'expose volontairement aucun nom réel (juste un code opaque + le nombre
// de lignes) — impossible de deviner le contenu d'une table depuis la liste ou une capture
// d'écran. Le nom réel n'est révélé que lorsqu'une table précise est ouverte (GET /tables/:code).
// Le code est dérivé du rang alphabétique (stable tant que les tables ne changent pas).
async function getSortedTableNames() {
  const [tables] = await db.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  );
  return tables.map(t => t.name);
}
function codeForIndex(i) { return `gpo${String(i + 1).padStart(2, '0')}`; }

// ── GET /api/db-admin/tables — liste des tables (codes opaques) + nombre de lignes ─
router.get('/tables', async (req, res) => {
  try {
    const names = await getSortedTableNames();
    const withCounts = [];
    for (let i = 0; i < names.length; i++) {
      try {
        const [[row]] = await db.execute(`SELECT COUNT(*) AS n FROM "${names[i]}"`);
        withCounts.push({ code: codeForIndex(i), count: row.n });
      } catch (_) {
        withCounts.push({ code: codeForIndex(i), count: null });
      }
    }
    ok(res, withCounts);
  } catch (err) { serverError(res, err); }
});

// ── GET /api/db-admin/tables/:code — colonnes + lignes paginées (révèle le nom réel) ─
router.get('/tables/:code', async (req, res) => {
  const code = req.params.code;
  try {
    const names = await getSortedTableNames();
    const match = /^gpo(\d+)$/i.exec(code);
    const idx   = match ? parseInt(match[1], 10) - 1 : -1;
    const name  = names[idx];
    if (!name) return notFound(res, 'Table introuvable');

    const [cols] = await db.execute(`PRAGMA table_info("${name}")`);
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [[{ n: total }]] = await db.execute(`SELECT COUNT(*) AS n FROM "${name}"`);
    const [rows] = await db.execute(`SELECT * FROM "${name}" LIMIT ? OFFSET ?`, [limit, offset]);

    ok(res, {
      realName: name,
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
