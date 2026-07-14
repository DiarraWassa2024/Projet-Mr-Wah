const router = require('express').Router();
const db     = require('../config/database');
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');
const NotificationService = require('../services/NotificationService');
const { ok, badRequest, notFound, serverError } = require('../helpers/response');

// POST /api/dettes — enregistre une dette d'un adhérent envers son organisation
router.post('/', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const { idAdh, numAgr, montantDette, motif, dateEcheance } = req.body;
    if (!idAdh || !numAgr || !montantDette || Number(montantDette) <= 0)
      return badRequest(res, 'idAdh, numAgr et montantDette (positif) requis');
    if (req.user.role === 'gestionnaire' && numAgr !== req.user.NumAgr)
      return res.status(403).json({ message: 'Vous ne pouvez créer une dette que pour votre propre organisation' });

    const [result] = await db.execute(
      `INSERT INTO SD_DetteAdherent (idAdh, numAgr, montantDette, montantRestant, motif, dateEcheance)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [idAdh, numAgr, Number(montantDette), Number(montantDette), motif || null, dateEcheance || null]
    );

    const [rows] = await db.execute(`SELECT idUser FROM GPOTB_Users WHERE idAdh = ? LIMIT 1`, [idAdh]);
    if (rows[0]) {
      await NotificationService.notifier({
        idUser: rows[0].idUser,
        titre: '💳 Nouvelle dette enregistrée',
        contenu: `Un montant de ${Number(montantDette).toLocaleString('fr-FR')} vous est réclamé${motif ? ' — ' + motif : ''}.`,
        type: 'dette',
        lien: '/dashboard',
      });
    }
    ok(res, { message: 'Dette enregistrée', id: result.insertId }, 201);
  } catch (err) { serverError(res, err); }
});

// GET /api/dettes — admin : tout ; gestionnaire : son organisation ; adhérent : les siennes
router.get('/', auth, async (req, res) => {
  try {
    let where = '1=1';
    const params = [];
    if (req.user.role === 'gestionnaire') { where += ' AND d.numAgr = ?'; params.push(req.user.NumAgr); }
    else if (req.user.role === 'adherent') { where += ' AND d.idAdh = ?'; params.push(req.user.idAdh); }

    const [rows] = await db.execute(
      `SELECT d.*, a.NomAdh, a.PrenAdh, o.LibOrg,
              CASE WHEN d.statut = 'En cours' AND d.dateEcheance IS NOT NULL AND d.dateEcheance < date('now')
                   THEN 1 ELSE 0 END AS enRetard
       FROM SD_DetteAdherent d
       LEFT JOIN GPOTB02_Adherent a ON a.idAdh = d.idAdh
       LEFT JOIN GPOTB01_Organisation o ON o.NumAgr = d.numAgr
       WHERE ${where}
       ORDER BY d.dateCreation DESC`,
      params
    );
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// POST /api/dettes/:id/rembourser — enregistre un remboursement (total ou partiel)
router.post('/:id/rembourser', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const { montant, commentaire } = req.body;
    if (!montant || Number(montant) <= 0) return badRequest(res, 'Montant invalide');

    const [[dette]] = await db.execute(`SELECT * FROM SD_DetteAdherent WHERE idDette = ?`, [req.params.id]);
    if (!dette) return notFound(res, 'Dette introuvable');
    if (req.user.role === 'gestionnaire' && dette.numAgr !== req.user.NumAgr)
      return res.status(403).json({ message: 'Cette dette ne concerne pas votre organisation' });

    const nouveauRestant = Math.max(0, dette.montantRestant - Number(montant));
    await db.execute(
      `INSERT INTO SD_RemboursementDette (idDette, montant, commentaire) VALUES (?, ?, ?)`,
      [req.params.id, Number(montant), commentaire || null]
    );
    await db.execute(
      `UPDATE SD_DetteAdherent SET montantRestant = ?, statut = ? WHERE idDette = ?`,
      [nouveauRestant, nouveauRestant <= 0 ? 'Réglée' : 'En cours', req.params.id]
    );
    ok(res, { message: 'Remboursement enregistré', montantRestant: nouveauRestant });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
