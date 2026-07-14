const router = require('express').Router();
const db     = require('../config/database');
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');
const { ok, badRequest, notFound, forbidden, serverError } = require('../helpers/response');

// GET /api/actualites — admin : toutes ; gestionnaire : les siennes + celles de la plateforme
router.get('/', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    let where = '1=1';
    const params = [];
    if (req.user.role === 'gestionnaire') { where += ' AND (a.numAgr = ? OR a.numAgr IS NULL)'; params.push(req.user.NumAgr); }

    const [rows] = await db.execute(
      `SELECT a.*, o.LibOrg FROM SD_Actualite a
       LEFT JOIN GPOTB01_Organisation o ON o.NumAgr = a.numAgr
       WHERE ${where} ORDER BY a.datePublication DESC`,
      params
    );
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// POST /api/actualites
router.post('/', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const { titre, contenu, image, statut } = req.body;
    if (!titre || !contenu) return badRequest(res, 'titre et contenu requis');
    const numAgr = req.user.role === 'gestionnaire' ? req.user.NumAgr : (req.body.numAgr || null);

    const [result] = await db.execute(
      `INSERT INTO SD_Actualite (titre, contenu, numAgr, idAuteur, image, statut) VALUES (?, ?, ?, ?, ?, ?)`,
      [titre, contenu, numAgr, req.user.idUser, image || null, statut === 'Brouillon' ? 'Brouillon' : 'Publiée']
    );
    ok(res, { message: 'Actualité créée', id: result.insertId }, 201);
  } catch (err) { serverError(res, err); }
});

// PUT /api/actualites/:id
router.put('/:id', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const [[actu]] = await db.execute(`SELECT numAgr FROM SD_Actualite WHERE idActu = ?`, [req.params.id]);
    if (!actu) return notFound(res, 'Actualité introuvable');
    if (req.user.role === 'gestionnaire' && actu.numAgr !== req.user.NumAgr)
      return forbidden(res, 'Cette actualité ne concerne pas votre organisation');

    const { titre, contenu, image, statut } = req.body;
    await db.execute(
      `UPDATE SD_Actualite SET titre = ?, contenu = ?, image = ?, statut = ? WHERE idActu = ?`,
      [titre, contenu, image || null, statut === 'Brouillon' ? 'Brouillon' : 'Publiée', req.params.id]
    );
    ok(res, { message: 'Actualité mise à jour' });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/actualites/:id
router.delete('/:id', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const [[actu]] = await db.execute(`SELECT numAgr FROM SD_Actualite WHERE idActu = ?`, [req.params.id]);
    if (!actu) return notFound(res, 'Actualité introuvable');
    if (req.user.role === 'gestionnaire' && actu.numAgr !== req.user.NumAgr)
      return forbidden(res, 'Cette actualité ne concerne pas votre organisation');

    await db.execute(`DELETE FROM SD_Actualite WHERE idActu = ?`, [req.params.id]);
    ok(res, { message: 'Actualité supprimée' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
