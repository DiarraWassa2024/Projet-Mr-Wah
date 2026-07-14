const router = require('express').Router();
const db     = require('../config/database');
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');
const { ok, badRequest, notFound, forbidden, serverError } = require('../helpers/response');

// GET /api/campagnes — admin : toutes ; gestionnaire : les siennes
router.get('/', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    let where = '1=1';
    const params = [];
    if (req.user.role === 'gestionnaire') { where += ' AND c.numAgr = ?'; params.push(req.user.NumAgr); }

    const [rows] = await db.execute(
      `SELECT c.*, o.LibOrg FROM SD_CampagneDon c
       LEFT JOIN GPOTB01_Organisation o ON o.NumAgr = c.numAgr
       WHERE ${where} ORDER BY c.dateCreation DESC`,
      params
    );
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// POST /api/campagnes — création (gestionnaire : uniquement pour sa propre organisation)
router.post('/', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const { numAgr, titre, description, objectifMontant, dateDebut, dateFin } = req.body;
    const numAgrCible = req.user.role === 'gestionnaire' ? req.user.NumAgr : numAgr;
    if (!numAgrCible || !titre || !objectifMontant || Number(objectifMontant) <= 0)
      return badRequest(res, 'numAgr, titre et objectifMontant (positif) requis');

    const [result] = await db.execute(
      `INSERT INTO SD_CampagneDon (numAgr, titre, description, objectifMontant, dateDebut, dateFin)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [numAgrCible, titre, description || null, Number(objectifMontant), dateDebut || null, dateFin || null]
    );
    ok(res, { message: 'Campagne créée', id: result.insertId }, 201);
  } catch (err) { serverError(res, err); }
});

// PUT /api/campagnes/:id/statut — clôturer ou annuler une campagne
router.put('/:id/statut', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const { statut } = req.body;
    if (!['Active', 'Clôturée', 'Annulée'].includes(statut)) return badRequest(res, 'Statut invalide');

    const [[campagne]] = await db.execute(`SELECT numAgr FROM SD_CampagneDon WHERE idCampagne = ?`, [req.params.id]);
    if (!campagne) return notFound(res, 'Campagne introuvable');
    if (req.user.role === 'gestionnaire' && campagne.numAgr !== req.user.NumAgr)
      return forbidden(res, 'Cette campagne ne concerne pas votre organisation');

    await db.execute(`UPDATE SD_CampagneDon SET statut = ? WHERE idCampagne = ?`, [statut, req.params.id]);
    ok(res, { message: 'Statut mis à jour' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
