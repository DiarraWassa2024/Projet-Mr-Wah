const router = require('express').Router();
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');
const { moral, physique } = require('../repositories/PrestataireRepository');
const { ok, created, notFound, badRequest, serverError } = require('../helpers/response');

const VALID_PAYS = new Set(['CIV', 'MLI', 'BEN', 'BFA', 'NGA', 'MDG']);

// Transitions de statut, même machine à états que les organisations
// (1=Actif, 2=Inactif, 3=Suspendu, 4=En attente, 5=Clôturé)
const TRANSITIONS = {
  4: [{ to: 1, action: 'valider'    }, { to: 5, action: 'rejeter'    }],
  1: [{ to: 3, action: 'suspendre'  }, { to: 2, action: 'desactiver' }, { to: 5, action: 'cloturer' }],
  3: [{ to: 1, action: 'reactiver'  }],
  2: [{ to: 1, action: 'reactiver'  }],
};

function todayDate() { return new Date().toISOString().split('T')[0]; }

/* ════════════════════════════════════════════════════════════
   PRESTATAIRES MORAUX (organisations prestataires)
   ════════════════════════════════════════════════════════════ */

router.get('/moraux', auth, async (req, res) => {
  try { ok(res, await moral.findAll(req.query)); }
  catch (err) { serverError(res, err); }
});

router.get('/moraux/:rcc', auth, async (req, res) => {
  try {
    const row = await moral.findByIdFull(req.params.rcc);
    if (!row) return notFound(res, 'Prestataire introuvable');
    ok(res, row);
  } catch (err) { serverError(res, err); }
});

router.post('/moraux', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  const { NomOrg, CodePays, EmailOrg, TelOrg, SiteWeb, Siege } = req.body;
  if (!NomOrg || NomOrg.trim().length < 2) return badRequest(res, 'Le nom est obligatoire (minimum 2 caractères)');
  if (!CodePays || !VALID_PAYS.has(CodePays)) return badRequest(res, 'Pays invalide');
  if (EmailOrg && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(EmailOrg)) return badRequest(res, 'Email invalide');

  try {
    const rcc = await moral.generateRcc(CodePays);
    await moral.create({
      rcc, NomOrg: NomOrg.trim(), CodePays,
      EmailOrg: EmailOrg || null, TelOrg: TelOrg || null,
      SiteWeb: SiteWeb || null, Siege: Siege || null,
      DateCrea: todayDate(), IdStatut: 4,
    });
    created(res, { message: 'Prestataire créé en attente de validation', rcc });
  } catch (err) { serverError(res, err); }
});

router.put('/moraux/:rcc', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  const { NomOrg, EmailOrg, TelOrg, SiteWeb, Siege } = req.body;
  if (!NomOrg || NomOrg.trim().length < 2) return badRequest(res, 'Le nom est obligatoire (minimum 2 caractères)');
  if (EmailOrg && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(EmailOrg)) return badRequest(res, 'Email invalide');

  try {
    const existing = await moral.findById(req.params.rcc);
    if (!existing) return notFound(res, 'Prestataire introuvable');
    await moral.update(req.params.rcc, {
      NomOrg: NomOrg.trim(), EmailOrg: EmailOrg || null,
      TelOrg: TelOrg || null, SiteWeb: SiteWeb || null, Siege: Siege || null,
    });
    ok(res, { message: 'Prestataire mis à jour' });
  } catch (err) { serverError(res, err); }
});

router.post('/moraux/:rcc/statut', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const row = await moral.findById(req.params.rcc);
    if (!row) return notFound(res, 'Prestataire introuvable');

    const { action } = req.body;
    const transition = (TRANSITIONS[row.IdStatut] || []).find(t => t.action === action);
    if (!transition) return badRequest(res, `Transition '${action}' non autorisée depuis le statut actuel`);

    await moral.update(req.params.rcc, { IdStatut: transition.to });
    ok(res, { message: 'Statut mis à jour', IdStatut: transition.to });
  } catch (err) { serverError(res, err); }
});

router.delete('/moraux/:rcc', auth, roles('admin'), async (req, res) => {
  try {
    const row = await moral.findById(req.params.rcc);
    if (!row) return notFound(res, 'Prestataire introuvable');
    if (row.IdStatut === 1)
      return badRequest(res, 'Impossible de supprimer un prestataire actif. Clôturez-le d\'abord.');
    await moral.delete(req.params.rcc);
    ok(res, { message: 'Prestataire supprimé' });
  } catch (err) { serverError(res, err); }
});

/* ════════════════════════════════════════════════════════════
   PRESTATAIRES PHYSIQUES (personnes prestataires)
   ════════════════════════════════════════════════════════════ */

router.get('/physiques', auth, async (req, res) => {
  try { ok(res, await physique.findAll(req.query)); }
  catch (err) { serverError(res, err); }
});

router.get('/physiques/:id', auth, async (req, res) => {
  try {
    const row = await physique.findByIdFull(req.params.id);
    if (!row) return notFound(res, 'Prestataire introuvable');
    ok(res, row);
  } catch (err) { serverError(res, err); }
});

router.post('/physiques', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  const { NomPrestataire, PrenPrestataire, DateNaissPrestataire, TelPrestataire,
          EmailPrestataire, Specialite, CodePays } = req.body;
  if (!NomPrestataire || NomPrestataire.trim().length < 2) return badRequest(res, 'Le nom est obligatoire (minimum 2 caractères)');
  if (!CodePays || !VALID_PAYS.has(CodePays)) return badRequest(res, 'Pays invalide');
  if (EmailPrestataire && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(EmailPrestataire)) return badRequest(res, 'Email invalide');

  try {
    const result = await physique.create({
      NomPrestataire: NomPrestataire.trim(), PrenPrestataire: PrenPrestataire || null,
      DateNaissPrestataire: DateNaissPrestataire || null, TelPrestataire: TelPrestataire || null,
      EmailPrestataire: EmailPrestataire || null, Specialite: Specialite || null,
      CodePays, IdStatut: 4, DateCreation: todayDate(),
    });
    created(res, { message: 'Prestataire créé en attente de validation', IdPrestataire: result.insertId });
  } catch (err) { serverError(res, err); }
});

router.put('/physiques/:id', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  const { NomPrestataire, PrenPrestataire, DateNaissPrestataire, TelPrestataire,
          EmailPrestataire, Specialite } = req.body;
  if (!NomPrestataire || NomPrestataire.trim().length < 2) return badRequest(res, 'Le nom est obligatoire (minimum 2 caractères)');
  if (EmailPrestataire && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(EmailPrestataire)) return badRequest(res, 'Email invalide');

  try {
    const existing = await physique.findById(req.params.id);
    if (!existing) return notFound(res, 'Prestataire introuvable');
    await physique.update(req.params.id, {
      NomPrestataire: NomPrestataire.trim(), PrenPrestataire: PrenPrestataire || null,
      DateNaissPrestataire: DateNaissPrestataire || null, TelPrestataire: TelPrestataire || null,
      EmailPrestataire: EmailPrestataire || null, Specialite: Specialite || null,
    });
    ok(res, { message: 'Prestataire mis à jour' });
  } catch (err) { serverError(res, err); }
});

router.post('/physiques/:id/statut', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const row = await physique.findById(req.params.id);
    if (!row) return notFound(res, 'Prestataire introuvable');

    const { action } = req.body;
    const transition = (TRANSITIONS[row.IdStatut] || []).find(t => t.action === action);
    if (!transition) return badRequest(res, `Transition '${action}' non autorisée depuis le statut actuel`);

    await physique.update(req.params.id, { IdStatut: transition.to });
    ok(res, { message: 'Statut mis à jour', IdStatut: transition.to });
  } catch (err) { serverError(res, err); }
});

router.delete('/physiques/:id', auth, roles('admin'), async (req, res) => {
  try {
    const row = await physique.findById(req.params.id);
    if (!row) return notFound(res, 'Prestataire introuvable');
    if (row.IdStatut === 1)
      return badRequest(res, 'Impossible de supprimer un prestataire actif. Clôturez-le d\'abord.');
    await physique.delete(req.params.id);
    ok(res, { message: 'Prestataire supprimé' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
