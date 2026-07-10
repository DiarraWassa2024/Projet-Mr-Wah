const router = require('express').Router();
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');
const db     = require('../config/database');
const { ok, created, notFound, badRequest, serverError } = require('../helpers/response');

// GET /api/autorisations-ministere — liste (admin/gestionnaire)
router.get('/', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const { numAgr, statut } = req.query;
    let sql = `SELECT a.*, m.LibMinistere, m.Domaine, m.CodePays, o.LibOrg
               FROM GPOTB29_AutorisationMinistere a
               LEFT JOIN GPOTB28_Ministere m ON m.IdMinistere = a.IdMinistere
               LEFT JOIN GPOTB01_Organisation o ON o.NumAgr = a.NumAgr
               WHERE 1=1`;
    const params = [];
    if (numAgr) { sql += ` AND a.NumAgr = ?`; params.push(numAgr); }
    if (statut) { sql += ` AND a.StatutAutorisation = ?`; params.push(statut); }
    sql += ` ORDER BY a.DateAutorisation DESC`;
    const [rows] = await db.execute(sql, params);
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// GET /api/autorisations-ministere/:id
router.get('/:id', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT a.*, m.LibMinistere, m.Domaine, m.CodePays, m.ContactEmail, m.ContactTel, o.LibOrg
       FROM GPOTB29_AutorisationMinistere a
       LEFT JOIN GPOTB28_Ministere m ON m.IdMinistere = a.IdMinistere
       LEFT JOIN GPOTB01_Organisation o ON o.NumAgr = a.NumAgr
       WHERE a.IdAutorMin = ?`,
      [req.params.id]
    );
    if (!rows[0]) return notFound(res, 'Autorisation introuvable');
    ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
});

// POST /api/autorisations-ministere
router.post('/', auth, roles('admin'), async (req, res) => {
  const { NumAgr, IdMinistere, NumeroDecision, DateAutorisation, DateExpiration,
          StatutAutorisation, DocumentPath, Observations } = req.body;
  if (!NumAgr || !IdMinistere || !DateAutorisation)
    return badRequest(res, 'NumAgr, IdMinistere et DateAutorisation sont obligatoires');
  try {
    const result = await db.execute(
      `INSERT INTO GPOTB29_AutorisationMinistere
         (NumAgr, IdMinistere, NumeroDecision, DateAutorisation, DateExpiration,
          StatutAutorisation, DocumentPath, Observations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [NumAgr, IdMinistere, NumeroDecision || null, DateAutorisation,
       DateExpiration || null, StatutAutorisation || 'Valide',
       DocumentPath || null, Observations || null]
    );
    created(res, { message: 'Autorisation créée', IdAutorMin: result[0].insertId });
  } catch (err) { serverError(res, err); }
});

// PUT /api/autorisations-ministere/:id
router.put('/:id', auth, roles('admin'), async (req, res) => {
  const { NumeroDecision, DateAutorisation, DateExpiration,
          StatutAutorisation, DocumentPath, Observations } = req.body;
  try {
    await db.execute(
      `UPDATE GPOTB29_AutorisationMinistere
       SET NumeroDecision=?, DateAutorisation=?, DateExpiration=?,
           StatutAutorisation=?, DocumentPath=?, Observations=?
       WHERE IdAutorMin=?`,
      [NumeroDecision || null, DateAutorisation, DateExpiration || null,
       StatutAutorisation || 'Valide', DocumentPath || null,
       Observations || null, req.params.id]
    );
    ok(res, { message: 'Autorisation mise à jour' });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/autorisations-ministere/:id
router.delete('/:id', auth, roles('admin'), async (req, res) => {
  try {
    await db.execute(`DELETE FROM GPOTB29_AutorisationMinistere WHERE IdAutorMin = ?`, [req.params.id]);
    ok(res, { message: 'Autorisation supprimée' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
