const router = require('express').Router();
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');
const db     = require('../config/database');
const { ok, created, notFound, badRequest, serverError } = require('../helpers/response');

// GET /api/groupes
router.get('/', auth, async (req, res) => {
  try {
    const { numAgr } = req.query;
    let sql = `SELECT g.*, o.LibOrg,
                      (SELECT COUNT(*) FROM GPOTB_UserGroupe ug WHERE ug.IdGroupe = g.IdGroupe) AS nbMembres
               FROM GPOTB31_GroupeUtilisateur g
               LEFT JOIN GPOTB01_Organisation o ON o.NumAgr = g.NumAgr
               WHERE 1=1`;
    const params = [];
    if (numAgr) { sql += ` AND g.NumAgr = ?`; params.push(numAgr); }
    sql += ` ORDER BY g.LibGroupe`;
    const [rows] = await db.execute(sql, params);
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// GET /api/groupes/:id/membres
router.get('/:id/membres', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.idUser, u.username, u.email, u.role, ug.DateAjout
       FROM GPOTB_UserGroupe ug
       JOIN GPOTB_Users u ON u.idUser = ug.idUser
       WHERE ug.IdGroupe = ?
       ORDER BY ug.DateAjout DESC`,
      [req.params.id]
    );
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// ── middleware : seul le créateur (ou admin) peut modifier son groupe ──
async function checkGroupeCreateur(req, res, next) {
  try {
    const [rows] = await db.execute(
      `SELECT idCreateur FROM GPOTB31_GroupeUtilisateur WHERE IdGroupe = ?`, [req.params.id]
    );
    if (!rows.length) return notFound(res, 'Groupe introuvable');
    const groupe = rows[0];
    if (req.user.role === 'admin') return next();
    if (groupe.idCreateur !== req.user.idUser)
      return res.status(403).json({ message: 'Seul le créateur de ce groupe peut le modifier' });
    next();
  } catch (err) { serverError(res, err); }
}

// POST /api/groupes
router.post('/', auth, async (req, res) => {
  const { LibGroupe, Description, NumAgr } = req.body;
  if (!LibGroupe) return badRequest(res, 'LibGroupe obligatoire');
  try {
    const result = await db.execute(
      `INSERT INTO GPOTB31_GroupeUtilisateur(LibGroupe, Description, NumAgr, idCreateur) VALUES(?, ?, ?, ?)`,
      [LibGroupe, Description || null, NumAgr || null, req.user.idUser]
    );
    created(res, { message: 'Groupe créé', IdGroupe: result[0].insertId });
  } catch (err) { serverError(res, err); }
});

// PUT /api/groupes/:id
router.put('/:id', auth, checkGroupeCreateur, async (req, res) => {
  const { LibGroupe, Description, NumAgr } = req.body;
  try {
    await db.execute(
      `UPDATE GPOTB31_GroupeUtilisateur SET LibGroupe=?, Description=?, NumAgr=? WHERE IdGroupe=?`,
      [LibGroupe, Description || null, NumAgr || null, req.params.id]
    );
    ok(res, { message: 'Groupe mis à jour' });
  } catch (err) { serverError(res, err); }
});

// POST /api/groupes/:id/membres — ajouter un membre
router.post('/:id/membres', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  const { idUser } = req.body;
  if (!idUser) return badRequest(res, 'idUser obligatoire');
  try {
    await db.execute(
      `INSERT INTO GPOTB_UserGroupe(idUser, IdGroupe) VALUES(?, ?)`,
      [idUser, req.params.id]
    );
    created(res, { message: 'Membre ajouté au groupe' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT')
      return res.status(409).json({ message: 'Utilisateur déjà dans ce groupe' });
    serverError(res, err);
  }
});

// DELETE /api/groupes/:id/membres/:userId — retirer un membre
router.delete('/:id/membres/:userId', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    await db.execute(
      `DELETE FROM GPOTB_UserGroupe WHERE IdGroupe = ? AND idUser = ?`,
      [req.params.id, req.params.userId]
    );
    ok(res, { message: 'Membre retiré du groupe' });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/groupes/:id
router.delete('/:id', auth, checkGroupeCreateur, async (req, res) => {
  try {
    await db.execute(`DELETE FROM GPOTB31_GroupeUtilisateur WHERE IdGroupe = ?`, [req.params.id]);
    ok(res, { message: 'Groupe supprimé' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
