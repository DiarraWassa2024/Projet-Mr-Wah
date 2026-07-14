const router            = require('express').Router();
const auth              = require('../middleware/auth');
const roles             = require('../middleware/roles');
const DemandeRepository = require('../repositories/DemandeRepository');
const DemandeService    = require('../services/DemandeService');
const DemandePolicy     = require('../policies/DemandePolicy');
const { ok, created, notFound, forbidden, serverError } = require('../helpers/response');

/**
 * Un gestionnaire (représentant d'une organisation) ne peut voir/traiter que les demandes
 * individuelles adressées à SA PROPRE organisation. L'admin voit et traite tout, y compris
 * les demandes d'organisation (création d'une nouvelle structure, qui n'a par définition
 * encore aucun gestionnaire pour se prononcer).
 */
function peutTraiter(req, demande) {
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'gestionnaire')
    return demande.typeOrg === 'Individu' && demande.numAgr === req.user.NumAgr;
  return false;
}

// GET /api/demandes
router.get('/', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const query = { ...req.query };
    if (req.user.role === 'gestionnaire') {
      query.typeOrg = 'Individu';
      query.numAgr  = req.user.NumAgr;
    }
    const rows = await DemandeRepository.findAll(query);
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// GET /api/demandes/stats
router.get('/stats', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const scope = req.user.role === 'gestionnaire' ? req.user.NumAgr : null;
    ok(res, await DemandeRepository.getStats(scope));
  } catch (err) { serverError(res, err); }
});

// GET /api/demandes/historique/logs
router.get('/historique/logs', auth, roles('admin'), async (req, res) => {
  try {
    ok(res, await DemandeRepository.getLogs());
  } catch (err) { serverError(res, err); }
});

// GET /api/demandes/:id
router.get('/:id', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const row = await DemandeRepository.findById(req.params.id);
    if (!row) return notFound(res, 'Demande introuvable');
    if (!peutTraiter(req, row)) return forbidden(res, 'Cette demande ne concerne pas votre organisation');
    ok(res, row);
  } catch (err) { serverError(res, err); }
});

// PUT /api/demandes/:id/accepter — admin (tout type) ou gestionnaire (demandes individuelles de sa propre organisation)
router.put('/:id/accepter', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const demande = await DemandeRepository.findById(req.params.id);
    if (!demande) return notFound(res, 'Demande introuvable');
    if (!peutTraiter(req, demande)) return forbidden(res, 'Cette demande ne concerne pas votre organisation');

    const result = await DemandeService.accept(req.params.id, req.user.username);
    ok(res, result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    serverError(res, err);
  }
});

// PUT /api/demandes/:id/refuser — admin (tout type) ou gestionnaire (demandes individuelles de sa propre organisation)
router.put('/:id/refuser', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const demande = await DemandeRepository.findById(req.params.id);
    if (!demande) return notFound(res, 'Demande introuvable');
    if (!peutTraiter(req, demande)) return forbidden(res, 'Cette demande ne concerne pas votre organisation');

    const result = await DemandeService.refuse(req.params.id, req.user.username, req.body.motif);
    ok(res, result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    serverError(res, err);
  }
});

// PUT /api/demandes/:id/rejeter-document — document justificatif jugé non authentique par
// l'admin après vérification : rejet définitif, sans remboursement. Admin uniquement (un
// gestionnaire jugeant le document de sa propre organisation serait en conflit d'intérêt).
router.put('/:id/rejeter-document', auth, roles('admin'), async (req, res) => {
  try {
    const result = await DemandeService.rejeterDocumentInvalide(req.params.id, req.user.username, req.body.motif);
    ok(res, result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    serverError(res, err);
  }
});

// PUT /api/demandes/:id/refuser-remboursement — refus volontaire de l'admin, document valide :
// si la cotisation a déjà été réglée, TAUX_REMBOURSEMENT_PCT % est remboursé immédiatement.
router.put('/:id/refuser-remboursement', auth, roles('admin'), async (req, res) => {
  try {
    const result = await DemandeService.refuserAvecRemboursement(req.params.id, req.user.username, req.body.motif);
    ok(res, result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    serverError(res, err);
  }
});

// PUT /api/demandes/:id/statut — changement manuel de statut (Actif→Suspendu, Radié, etc.) — admin uniquement
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
router.get('/:id/historique', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const demande = await DemandeRepository.findById(req.params.id);
    if (!demande) return notFound(res, 'Demande introuvable');
    if (!peutTraiter(req, demande)) return forbidden(res, 'Cette demande ne concerne pas votre organisation');
    const rows = await DemandeRepository.getHistoriqueStatut(req.params.id);
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

module.exports = router;
