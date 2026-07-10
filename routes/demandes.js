const router            = require('express').Router();
const auth              = require('../middleware/auth');
const roles             = require('../middleware/roles');
const DemandeRepository = require('../repositories/DemandeRepository');
const DemandeService    = require('../services/DemandeService');
const DemandePolicy     = require('../policies/DemandePolicy');
const { ok, created, notFound, forbidden, serverError } = require('../helpers/response');

// GET /api/demandes
router.get('/', auth, async (req, res) => {
  try {
    const rows = await DemandeRepository.findAll(req.query);
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// GET /api/demandes/stats
router.get('/stats', auth, async (req, res) => {
  try {
    ok(res, await DemandeRepository.getStats());
  } catch (err) { serverError(res, err); }
});

// GET /api/demandes/historique/logs
router.get('/historique/logs', auth, roles('admin'), async (req, res) => {
  try {
    ok(res, await DemandeRepository.getLogs());
  } catch (err) { serverError(res, err); }
});

// GET /api/demandes/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const row = await DemandeRepository.findById(req.params.id);
    if (!row) return notFound(res, 'Demande introuvable');
    ok(res, row);
  } catch (err) { serverError(res, err); }
});

// PUT /api/demandes/:id/accepter — admin uniquement
router.put('/:id/accepter', auth, roles('admin'), async (req, res) => {
  try {
    const result = await DemandeService.accept(req.params.id, req.user.username);
    ok(res, result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    serverError(res, err);
  }
});

// PUT /api/demandes/:id/refuser — admin uniquement
router.put('/:id/refuser', auth, roles('admin'), async (req, res) => {
  try {
    const result = await DemandeService.refuse(req.params.id, req.user.username, req.body.motif);
    ok(res, result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    serverError(res, err);
  }
});

// PUT /api/demandes/:id/statut — changement manuel de statut (Actif→Suspendu, Radié, etc.)
router.put('/:id/statut', auth, roles('admin'), async (req, res) => {
  try {
    const result = await DemandeService.changeStatut(
      req.params.id, req.body.statut, req.user.username, req.body.commentaire
    );
    ok(res, result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    serverError(res, err);
  }
});

// GET /api/demandes/:id/historique — timeline des changements de statut
router.get('/:id/historique', auth, async (req, res) => {
  try {
    const rows = await DemandeRepository.getHistoriqueStatut(req.params.id);
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

module.exports = router;
