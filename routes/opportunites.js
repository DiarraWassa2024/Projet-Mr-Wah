const router               = require('express').Router();
const auth                 = require('../middleware/auth');
const roles                = require('../middleware/roles');
const OpportuniteRepository = require('../repositories/OpportuniteRepository');
const { nowISO }           = require('../helpers/dateHelper');
const { ok, created, badRequest, serverError } = require('../helpers/response');

// GET /api/opportunites
router.get('/', async (req, res) => {
  try {
    const rows = await OpportuniteRepository.findAll(req.query);
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// GET /api/opportunites/stats
router.get('/stats', async (req, res) => {
  try {
    const db = require('../config/database');
    const [[totals]] = await db.execute(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN statut='Active'   THEN 1 ELSE 0 END) AS actives,
        SUM(CASE WHEN statut='Clôturée' THEN 1 ELSE 0 END) AS cloturees,
        SUM(CASE WHEN statut='Annulée'  THEN 1 ELSE 0 END) AS annulees,
        SUM(CASE WHEN dateLimite < date('now') AND statut='Active' THEN 1 ELSE 0 END) AS expirees
      FROM SD_Opportunite`);
    const [byCat] = await db.execute(`SELECT categorie, COUNT(*) AS nb FROM SD_Opportunite GROUP BY categorie`);
    ok(res, { ...totals, byCat });
  } catch (err) { serverError(res, err); }
});

// POST /api/opportunites
router.post('/', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const { titre, categorie, domaine, pays, description, dateLimite, lien, budget, codeDevise, numAgr, statut } = req.body;
    if (!titre) return badRequest(res, 'Titre obligatoire');
    const result = await OpportuniteRepository.create({
      titre, categorie: categorie || null, domaine: domaine || null, pays: pays || null,
      description: description || null, dateLimite: dateLimite || null,
      lien: lien || null, budget: budget || null, codeDevise: codeDevise || 'FCFA',
      numAgr: numAgr || null, statut: statut || 'Active',
      datePublication: nowISO(), auteur: req.user.username,
    });
    created(res, { id: result.insertId, message: 'Opportunité créée' });
  } catch (err) { serverError(res, err); }
});

// PUT /api/opportunites/:id
router.put('/:id', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const { titre, categorie, domaine, pays, description, dateLimite, lien, budget, codeDevise, numAgr, statut } = req.body;
    await OpportuniteRepository.update(req.params.id, {
      titre, categorie: categorie || null, domaine: domaine || null, pays: pays || null,
      description: description || null, dateLimite: dateLimite || null,
      lien: lien || null, budget: budget || null, codeDevise: codeDevise || null,
      numAgr: numAgr || null, statut: statut || 'Active',
    });
    ok(res, { message: 'Opportunité mise à jour' });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/opportunites/:id
router.delete('/:id', auth, roles('admin'), async (req, res) => {
  try {
    await OpportuniteRepository.delete(req.params.id);
    ok(res, { message: 'Opportunité supprimée' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
