const router    = require('express').Router();
const path      = require('path');
const fs        = require('fs');
const multer    = require('multer');
const qrcode    = require('qrcode');
const auth      = require('../middleware/auth');
const roles     = require('../middleware/roles');
const OrganisationRepository = require('../repositories/OrganisationRepository');
const PurgeService = require('../services/PurgeService');
const { ok, created, notFound, badRequest, forbidden, serverError } = require('../helpers/response');
const { buildCarteOfficielle } = require('../helpers/carteTemplate');

/** Un gestionnaire ne voit/modifie que sa propre organisation ; l'admin voit tout. */
function isOwnOrg(req, numAgr) {
  return req.user.role === 'admin' || req.user.NumAgr === numAgr;
}

// ── Multer — documents organisation ───────────────────────────
const uploadDir = path.join(__dirname, '../public/uploads/orgs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    cb(null, `org_${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// ── Multer — logo organisation ──────────────────────────────────
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    cb(null, `orglogo_${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
  },
});
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// ── Constantes ─────────────────────────────────────────────────
const TYPE_CODE  = { 1: 'ASS', 2: 'ONG', 6: 'MUT' };
const VALID_PAYS = new Set(['CIV', 'MLI', 'BEN', 'BFA', 'NGA', 'MDG']);

const TRANSITIONS = {
  4: [{ to: 1, action: 'valider'    }, { to: 5, action: 'rejeter'    }],
  1: [{ to: 3, action: 'suspendre'  }, { to: 2, action: 'desactiver' }, { to: 5, action: 'cloturer' }],
  3: [{ to: 1, action: 'reactiver'  }],
  2: [{ to: 1, action: 'reactiver'  }],
};

// ── Validation ─────────────────────────────────────────────────
function validate(body, isCreate) {
  if (!body.LibOrg || body.LibOrg.trim().length < 3)
    return 'Le nom doit comporter au moins 3 caractères';
  if (body.LibOrg.trim().length > 150)
    return 'Le nom ne peut dépasser 150 caractères';
  if (isCreate) {
    if (!body.CodePays)                return 'Le pays est obligatoire';
    if (!VALID_PAYS.has(body.CodePays)) return 'Pays non reconnu';
    if (!body.IdTypOrg)                return 'Le type est obligatoire';
    if (!TYPE_CODE[body.IdTypOrg])     return 'Type invalide (Association / ONG / Mutuelle)';
  }
  if (body.EmailOrg && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.EmailOrg))
    return 'Email invalide';
  if (body.TelOrg && body.TelOrg.replace(/\s/g, '').length < 8)
    return 'Numéro de téléphone trop court';
  if (body.SiteWeb && !/^https?:\/\//.test(body.SiteWeb))
    return 'Le site web doit commencer par http:// ou https://';
  if (body.DateCreOrg) {
    const d = new Date(body.DateCreOrg);
    if (isNaN(d.getTime())) return 'Date de création invalide';
    if (d > new Date())     return 'La date de création ne peut pas être dans le futur';
  }
  return null;
}

// ── GET /api/organisations ─────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'gestionnaire' || req.user.role === 'adherent') {
      const org = req.user.NumAgr ? await OrganisationRepository.findByIdFull(req.user.NumAgr) : null;
      return ok(res, org ? [org] : []);
    }
    ok(res, await OrganisationRepository.findAll(req.query));
  } catch (err) { serverError(res, err); }
});

// ── GET /api/organisations/:id ─────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    if (!isOwnOrg(req, req.params.id)) return forbidden(res, 'Cette organisation ne vous concerne pas');
    const org = await OrganisationRepository.findByIdFull(req.params.id);
    if (!org) return notFound(res, 'Organisation non trouvée');
    ok(res, org);
  } catch (err) { serverError(res, err); }
});

// ── GET /api/organisations/:id/carte ────────────────────────────
router.get('/:id/carte', auth, async (req, res) => {
  try {
    if (!isOwnOrg(req, req.params.id)) return forbidden(res, 'Cette organisation ne vous concerne pas');
    const org = await OrganisationRepository.findByIdFull(req.params.id);
    if (!org) return notFound(res, 'Organisation non trouvée');

    // Le QR code encode une vraie URL — scannée avec n'importe quel appareil photo, elle ouvre
    // directement la fiche de vérification publique de l'organisation.
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const qrData = `${appUrl}/verifier-organisation?code=${encodeURIComponent(org.NumAgr)}`;
    const qrUrl  = await qrcode.toDataURL(qrData, { width: 220, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } });

    const dateExpiration = org.DateCreOrg
      ? new Date(new Date(org.DateCreOrg).setFullYear(new Date(org.DateCreOrg).getFullYear() + 1))
      : null;

    const html = buildCarteOfficielle({
      type: 'organisation',
      orgName: org.LibOrg,
      orgLogoUrl: org.Logo || null,
      idCode: org.NumAgr,
      nom: org.LibOrg,
      typeOrg: org.LibTypOrg,
      pays: org.LibPays || org.CodePays,
      siege: org.SiegeOrg,
      representant: [org.NomRepresentant, org.FonctionRepresentant].filter(Boolean).join(' — '),
      photoUrl: org.Logo || null,
      initiales: (org.LibOrg || '?')[0].toUpperCase(),
      qrDataUrl: qrUrl,
      dateEtablissement: org.DateCreOrg,
      dateExpiration,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { serverError(res, err); }
});

// ── POST /api/organisations ────────────────────────────────────
router.post('/', auth, roles('admin'), async (req, res) => {
  const errMsg = validate(req.body, true);
  if (errMsg) return badRequest(res, errMsg);

  const {
    LibOrg, CodePays, IdTypOrg, IdVocOrg, DateCreOrg, SiegeOrg,
    EmailOrg, TelOrg, SiteWeb, Description,
    NomRepresentant, FonctionRepresentant, IdRegleInt, CodeDevise,
  } = req.body;

  try {
    const typeCode = TYPE_CODE[parseInt(IdTypOrg)];
    const NumAgr   = await OrganisationRepository.generateNumAgr(CodePays, typeCode);

    await OrganisationRepository.create({
      NumAgr,
      LibOrg:               LibOrg.trim(),
      CodePays,
      IdTypOrg:             parseInt(IdTypOrg),
      IdVocOrg:             IdVocOrg   ? parseInt(IdVocOrg)   : null,
      DateCreOrg:           DateCreOrg || null,
      SiegeOrg:             SiegeOrg   || null,
      EmailOrg:             EmailOrg   || null,
      TelOrg:               TelOrg     || null,
      SiteWeb:              SiteWeb    || null,
      Description:          Description || null,
      NomRepresentant:      NomRepresentant     || null,
      FonctionRepresentant: FonctionRepresentant || null,
      IdRegleInt:           IdRegleInt ? parseInt(IdRegleInt) : null,
      CodeDevise:           CodeDevise || null,
      IdStatut:             4,
    });
    created(res, { message: 'Organisation créée en attente de validation', NumAgr });
  } catch (err) { serverError(res, err); }
});

// ── PUT /api/organisations/:id ─────────────────────────────────
router.put('/:id', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  if (!isOwnOrg(req, req.params.id)) return forbidden(res, 'Cette organisation ne vous concerne pas');
  const errMsg = validate(req.body, false);
  if (errMsg) return badRequest(res, errMsg);

  const {
    LibOrg, IdVocOrg, DateCreOrg, SiegeOrg, EmailOrg, TelOrg,
    SiteWeb, Description, NomRepresentant, FonctionRepresentant,
    IdRegleInt, CodeDevise,
  } = req.body;

  try {
    const exists = await OrganisationRepository.findByIdFull(req.params.id);
    if (!exists) return notFound(res, 'Organisation non trouvée');

    await OrganisationRepository.update(req.params.id, {
      LibOrg:               LibOrg ? LibOrg.trim() : exists.LibOrg,
      IdVocOrg:             IdVocOrg   ? parseInt(IdVocOrg)   : null,
      DateCreOrg:           DateCreOrg || null,
      SiegeOrg:             SiegeOrg   || null,
      EmailOrg:             EmailOrg   || null,
      TelOrg:               TelOrg     || null,
      SiteWeb:              SiteWeb    || null,
      Description:          Description || null,
      NomRepresentant:      NomRepresentant     || null,
      FonctionRepresentant: FonctionRepresentant || null,
      IdRegleInt:           IdRegleInt ? parseInt(IdRegleInt) : null,
      CodeDevise:           CodeDevise || null,
    });
    ok(res, { message: 'Organisation mise à jour' });
  } catch (err) { serverError(res, err); }
});

// ── POST /api/organisations/:id/logo ──────────────────────────
router.post('/:id/logo', auth, roles('admin', 'gestionnaire'), uploadLogo.single('logo'), async (req, res) => {
  if (!isOwnOrg(req, req.params.id)) return forbidden(res, 'Cette organisation ne vous concerne pas');
  if (!req.file) return badRequest(res, 'Logo requis (jpg/png/webp/svg, max 5 Mo)');
  try {
    const org = await OrganisationRepository.findByIdFull(req.params.id);
    if (!org) return notFound(res, 'Organisation non trouvée');

    if (org.Logo) {
      const fp = path.join(__dirname, '../public', org.Logo);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    const Logo = `/uploads/orgs/${req.file.filename}`;
    await OrganisationRepository.update(req.params.id, { Logo });
    ok(res, { message: 'Logo mis à jour', Logo });
  } catch (err) { serverError(res, err); }
});

// ── POST /api/organisations/:id/statut ────────────────────────
router.post('/:id/statut', auth, roles('admin'), async (req, res) => {
  try {
    const org = await OrganisationRepository.findByIdFull(req.params.id);
    if (!org) return notFound(res, 'Organisation non trouvée');

    const { action } = req.body;
    const transition = (TRANSITIONS[org.IdStatut] || []).find(t => t.action === action);
    if (!transition) return badRequest(res, `Transition '${action}' non autorisée depuis le statut actuel`);

    await OrganisationRepository.update(req.params.id, { IdStatut: transition.to });
    ok(res, { message: 'Statut mis à jour', IdStatut: transition.to });
  } catch (err) { serverError(res, err); }
});

// ── GET /api/organisations/:id/documents ──────────────────────
router.get('/:id/documents', auth, async (req, res) => {
  try {
    if (!isOwnOrg(req, req.params.id)) return forbidden(res, 'Cette organisation ne vous concerne pas');
    ok(res, await OrganisationRepository.getDocuments(req.params.id));
  } catch (err) { serverError(res, err); }
});

// ── POST /api/organisations/:id/documents ─────────────────────
router.post('/:id/documents', auth, roles('admin', 'gestionnaire'), upload.single('fichier'), async (req, res) => {
  if (!isOwnOrg(req, req.params.id)) return forbidden(res, 'Cette organisation ne vous concerne pas');
  if (!req.file) return badRequest(res, 'Fichier requis');
  const { LibDoc, TypeDoc } = req.body;
  if (!LibDoc || !LibDoc.trim()) return badRequest(res, 'Nom du document requis');

  try {
    const org = await OrganisationRepository.findByIdFull(req.params.id);
    if (!org) return notFound(res, 'Organisation non trouvée');

    const cheminFichier = `/uploads/orgs/${req.file.filename}`;
    const id = await OrganisationRepository.addDocument({
      LibDoc:        LibDoc.trim(),
      TypeDoc:       TypeDoc || 'Autre',
      CheminFichier: cheminFichier,
      NumAgr:        req.params.id,
      DateDocument:  new Date().toISOString().split('T')[0],
    });
    created(res, { message: 'Document ajouté', id, CheminFichier: cheminFichier });
  } catch (err) { serverError(res, err); }
});

// ── DELETE /api/organisations/:id/documents/:docId ───────────
router.delete('/:id/documents/:docId', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  if (!isOwnOrg(req, req.params.id)) return forbidden(res, 'Cette organisation ne vous concerne pas');
  try {
    const doc = await OrganisationRepository.getDocumentById(req.params.docId, req.params.id);
    if (!doc) return notFound(res, 'Document non trouvé');

    const fp = path.join(__dirname, '../public', doc.CheminFichier);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    await OrganisationRepository.deleteDocument(req.params.docId);
    ok(res, { message: 'Document supprimé' });
  } catch (err) { serverError(res, err); }
});

// ── DELETE /api/organisations/:id ─────────────────────────────
router.delete('/:id', auth, roles('admin'), async (req, res) => {
  try {
    const org = await OrganisationRepository.findByIdFull(req.params.id);
    if (!org) return notFound(res, 'Organisation non trouvée');
    if (!PurgeService.STATUTS_SUPPRIMABLES.includes(org.IdStatut))
      return badRequest(res, "Seule une organisation suspendue ou clôturée peut être supprimée définitivement.");
    PurgeService.purgerOrganisation(req.params.id);
    ok(res, { message: 'Organisation supprimée définitivement, avec tous ses adhérents et données rattachées' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
