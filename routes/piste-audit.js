const router          = require('express').Router();
const auth            = require('../middleware/auth');
const roles           = require('../middleware/roles');
const AuditRepository = require('../repositories/AuditRepository');
const AuditService    = require('../services/AuditService');
const { ok, badRequest, serverError } = require('../helpers/response');

const ACTIONS_VALIDES = [
  'CONNEXION','DECONNEXION','CREATION','SUPPRESSION','MODIFICATION',
  'PAIEMENT','VALIDATION','IMPRESSION','EXPORT','RECHERCHE',
];

/* ── GET /api/piste-audit/stats ───────────────────────────────── */
router.get('/stats', auth, roles('admin'), (req, res) => {
  try {
    ok(res, AuditRepository.stats(req.query));
  } catch(err) { serverError(res, err); }
});

/* ── GET /api/piste-audit ─────────────────────────────────────── */
router.get('/', auth, roles('admin'), async (req, res) => {
  try {
    ok(res, await AuditRepository.findAll(req.query));
  } catch(err) { serverError(res, err); }
});

/* ── POST /api/piste-audit/event ──────────────────────────────── */
/* Permet au client de logger des events non-HTTP (impression, export, recherche UI) */
router.post('/event', auth, async (req, res) => {
  try {
    const { action, module, details } = req.body;
    if (!action) return badRequest(res, 'Action requise');
    if (!ACTIONS_VALIDES.includes(action)) return badRequest(res, 'Action invalide');
    await AuditService.log(action, req, { module, details });
    ok(res, { logged: true });
  } catch(err) { serverError(res, err); }
});

module.exports = router;
