const router          = require('express').Router();
const auth            = require('../middleware/auth');
const roles           = require('../middleware/roles');
const BesoinRepository = require('../repositories/BesoinRepository');
const { nowISO }      = require('../helpers/dateHelper');
const { ok, created, badRequest, serverError } = require('../helpers/response');

router.use(auth);

// GET /api/besoins-admin
router.get('/', async (req, res) => {
  try {
    // Un gestionnaire ne voit que les besoins adressés à sa propre organisation.
    const numAgr = req.user.role === 'gestionnaire' ? req.user.NumAgr : undefined;
    const rows = await BesoinRepository.findAll({ ...req.query, numAgr });
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// POST /api/besoins-admin — créer un besoin (admin/gestionnaire)
router.post('/', roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const { nom, email, organisation, numAgr, typeBesoin, typeEntite, description,
            budgetEstimatif, codeDevise, priorite, domaine, codePays } = req.body;
    if (!nom) return badRequest(res, 'Nom obligatoire');
    const db = require('../config/database');
    const result = await db.execute(
      `INSERT INTO SD_BesoinExprime(nom,email,organisation,numAgr,typeBesoin,typeEntite,description,
        budgetEstimatif,codeDevise,priorite,domaine,codePays,DateDemande)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [nom, email||null, organisation||null, numAgr||null, typeBesoin||null, typeEntite||null,
       description||null, budgetEstimatif||null, codeDevise||'FCFA', priorite||'Normale',
       domaine||null, codePays||null, nowISO()]
    );
    created(res, { id: result[0].insertId, message: 'Besoin créé' });
  } catch (err) { serverError(res, err); }
});

// PUT /api/besoins-admin/:id/traiter
router.put('/:id/traiter', roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    await BesoinRepository.markTraited(req.params.id, req.user.username, nowISO());
    ok(res, { message: 'Besoin marqué comme traité' });
  } catch (err) { serverError(res, err); }
});

// PUT /api/besoins-admin/:id/statut
router.put('/:id/statut', roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const { statut } = req.body;
    await BesoinRepository.update(req.params.id, { statut });
    ok(res, { message: 'Statut mis à jour' });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/besoins-admin/:id
router.delete('/:id', roles('admin'), async (req, res) => {
  try {
    await BesoinRepository.delete(req.params.id);
    ok(res, { message: 'Besoin supprimé' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
