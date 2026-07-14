const router = require('express').Router();
const db     = require('../config/database');
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');
const { ok, serverError } = require('../helpers/response');

// GET /api/dons — liste + agrégats. Admin : tous les dons. Gestionnaire : uniquement
// les dons reçus par sa propre organisation (montant net après commission plateforme).
router.get('/', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    let where  = '1=1';
    const params = [];
    if (req.user.role === 'gestionnaire') {
      where += ' AND d.numAgr = ?';
      params.push(req.user.NumAgr);
    }

    const [rows] = await db.execute(
      `SELECT d.*, o.LibOrg AS orgLibOrg
       FROM SD_Don d
       LEFT JOIN GPOTB01_Organisation o ON o.NumAgr = d.numAgr
       WHERE ${where}
       ORDER BY d.dateDon DESC LIMIT 100`,
      params
    );

    const [[agg]] = await db.execute(
      `SELECT COUNT(*) AS nb,
              COALESCE(SUM(montant),0)        AS totalBrut,
              COALESCE(SUM(montantOrg),0)     AS totalOrg,
              COALESCE(SUM(montantPlateforme),0) AS totalPlateforme
       FROM SD_Don d WHERE ${where}`,
      params
    );

    ok(res, { dons: rows, total: agg.nb, totalBrut: agg.totalBrut, totalOrg: agg.totalOrg, totalPlateforme: agg.totalPlateforme });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
