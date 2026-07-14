const router = require('express').Router();
const db     = require('../config/database');
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');
const { ok, badRequest, notFound, serverError } = require('../helpers/response');

// GET /api/faq — admin uniquement (gestion complète, y compris inactives)
router.get('/', auth, roles('admin'), async (req, res) => {
  try {
    const [rows] = await db.execute(`SELECT * FROM SD_FAQ ORDER BY ordre ASC, idFAQ ASC`);
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// POST /api/faq
router.post('/', auth, roles('admin'), async (req, res) => {
  try {
    const { question, reponse, categorie, ordre } = req.body;
    if (!question || !reponse) return badRequest(res, 'question et reponse requises');
    const [result] = await db.execute(
      `INSERT INTO SD_FAQ (question, reponse, categorie, ordre) VALUES (?, ?, ?, ?)`,
      [question, reponse, categorie || null, Number(ordre) || 0]
    );
    ok(res, { message: 'FAQ créée', id: result.insertId }, 201);
  } catch (err) { serverError(res, err); }
});

// PUT /api/faq/:id
router.put('/:id', auth, roles('admin'), async (req, res) => {
  try {
    const [[row]] = await db.execute(`SELECT idFAQ FROM SD_FAQ WHERE idFAQ = ?`, [req.params.id]);
    if (!row) return notFound(res, 'FAQ introuvable');
    const { question, reponse, categorie, ordre, actif } = req.body;
    await db.execute(
      `UPDATE SD_FAQ SET question = ?, reponse = ?, categorie = ?, ordre = ?, actif = ? WHERE idFAQ = ?`,
      [question, reponse, categorie || null, Number(ordre) || 0, actif ? 1 : 0, req.params.id]
    );
    ok(res, { message: 'FAQ mise à jour' });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/faq/:id
router.delete('/:id', auth, roles('admin'), async (req, res) => {
  try {
    await db.execute(`DELETE FROM SD_FAQ WHERE idFAQ = ?`, [req.params.id]);
    ok(res, { message: 'FAQ supprimée' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
