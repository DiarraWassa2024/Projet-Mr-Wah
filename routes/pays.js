const router = require('express').Router();
const db     = require('../config/database');
const { ok, notFound, serverError } = require('../helpers/response');

// GET /api/pays — tous les pays avec données complètes
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT p.*,
             d.LibDevise, d.Symbole AS SymboleDevise, d.TauxParRapportEuro,
             m.LibMinistere AS MinistereDefaut, m.Domaine AS DomaineMinistere
      FROM GPOTB03_Pays p
      LEFT JOIN GPOTB27_Devise d ON d.CodeDevise = p.CodeDevise
      LEFT JOIN GPOTB28_Ministere m ON m.IdMinistere = p.IdMinistereDefaut
      ORDER BY p.LibPays
    `);
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// GET /api/pays/:code — un pays complet avec ses ministères
router.get('/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const [rows] = await db.execute(`
      SELECT p.*,
             d.LibDevise, d.Symbole AS SymboleDevise, d.TauxParRapportEuro,
             m.LibMinistere AS MinistereDefaut, m.Domaine AS DomaineMinistere
      FROM GPOTB03_Pays p
      LEFT JOIN GPOTB27_Devise d ON d.CodeDevise = p.CodeDevise
      LEFT JOIN GPOTB28_Ministere m ON m.IdMinistere = p.IdMinistereDefaut
      WHERE p.CodePays = ?
    `, [code]);
    if (!rows[0]) return notFound(res, 'Pays non trouvé');

    // Ministères disponibles pour ce pays
    const [ministeres] = await db.execute(
      `SELECT IdMinistere AS id, LibMinistere AS lib, Domaine AS domaine
       FROM GPOTB28_Ministere WHERE CodePays = ? ORDER BY LibMinistere`,
      [code]
    );
    ok(res, { ...rows[0], ministeres });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
