const router  = require('express').Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const qrcode  = require('qrcode');
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const AdherentRepository     = require('../repositories/AdherentRepository');
const OrganisationRepository = require('../repositories/OrganisationRepository');
const PurgeService = require('../services/PurgeService');
const emailSvc = require('../services/EmailService');
const { ok, created, notFound, badRequest, forbidden, serverError } = require('../helpers/response');
const { buildCarteOfficielle } = require('../helpers/carteTemplate');

/**
 * Un gestionnaire gère tous les adhérents de sa propre organisation ; un adhérent (individu
 * connecté à son propre espace) ne voit/modifie que SA PROPRE fiche, jamais celle d'un autre
 * membre de l'organisation ; l'admin voit et modifie tout.
 */
function isOwnAdh(req, adh) {
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'gestionnaire') return !!(adh && adh.NumAgr === req.user.NumAgr);
  if (req.user.role === 'adherent') return !!(adh && adh.idAdh === req.user.idAdh);
  return false;
}

// ── Multer — photos & documents adhérents ──────────────────────
const photoDir = path.join(__dirname, '../public/uploads/adherents/photos');
const docDir   = path.join(__dirname, '../public/uploads/adherents/docs');
[photoDir, docDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, photoDir),
  filename:    (req, file, cb) => cb(null, `adh_${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
});
const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file.originalname).toLowerCase()));
  },
});

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, docDir),
  filename:    (req, file, cb) => cb(null, `adhdoc_${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
});
const uploadDoc = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// ── Workflow ───────────────────────────────────────────────────
const TRANSITIONS = {
  4: [
    { to: 1, action: 'valider',   email: 'bienvenue' },
    { to: 5, action: 'refuser',   email: 'refus'     },
  ],
  1: [
    { to: 3, action: 'suspendre' },
    { to: 5, action: 'resilier'  },
  ],
  3: [{ to: 1, action: 'reactiver' }],
  2: [{ to: 1, action: 'reactiver' }],
};

// ── Validation ─────────────────────────────────────────────────
function validate(body, isCreate) {
  if (!body.NomAdh || body.NomAdh.trim().length < 2)
    return 'Le nom est obligatoire (minimum 2 caractères)';
  if (body.NomAdh.trim().length > 100)
    return 'Le nom ne peut dépasser 100 caractères';
  if (isCreate && !body.NumAgr)
    return "L'organisation est obligatoire";
  if (body.EmailAdh && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.EmailAdh))
    return 'Email invalide';
  if (body.TelAdh && body.TelAdh.replace(/\s/g, '').length < 8)
    return 'Numéro de téléphone trop court (8 chiffres minimum)';
  if (isCreate && !body.Sexe)
    return 'Le sexe est obligatoire';
  if (body.DateNaissAdh) {
    const d = new Date(body.DateNaissAdh);
    if (isNaN(d.getTime())) return 'Date de naissance invalide';
    if (d > new Date()) return 'La date de naissance ne peut pas être dans le futur';
    const dateLimite18ans = new Date();
    dateLimite18ans.setFullYear(dateLimite18ans.getFullYear() - 18);
    if (d > dateLimite18ans) return "L'adhérent doit avoir au moins 18 ans pour s'inscrire";
  }
  return null;
}

// ── GET /api/adherents ─────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'adherent') {
      const adh = req.user.idAdh ? await AdherentRepository.findByIdFull(req.user.idAdh) : null;
      return ok(res, adh ? [adh] : []);
    }
    const query = { ...req.query };
    if (req.user.role === 'gestionnaire') query.org = req.user.NumAgr;
    ok(res, await AdherentRepository.findAll(query));
  } catch (err) { serverError(res, err); }
});

// ── GET /api/adherents/mes-organisations ────────────────────────
// Un même adhérent peut avoir rejoint plusieurs organisations (une ligne GPOTB02_Adherent par
// organisation, reliées par le même email) — le compte de connexion, lui, ne pointe que sur l'une
// d'entre elles (idAdh du JWT). Cette route retourne donc l'ensemble des adhésions par email.
router.get('/mes-organisations', auth, roles('adherent'), async (req, res) => {
  try {
    if (!req.user.email) return ok(res, []);
    ok(res, await AdherentRepository.findAllByEmail(req.user.email));
  } catch (err) { serverError(res, err); }
});

// ── GET /api/adherents/:id ─────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const adh = await AdherentRepository.findByIdFull(req.params.id);
    if (!adh) return notFound(res, 'Adhérent non trouvé');
    if (!isOwnAdh(req, adh)) return forbidden(res, 'Cet adhérent ne concerne pas votre organisation');
    ok(res, adh);
  } catch (err) { serverError(res, err); }
});

// ── POST /api/adherents ────────────────────────────────────────
router.post('/', auth, roles('admin', 'gestionnaire'), uploadPhoto.single('photo'), async (req, res) => {
  const errMsg = validate(req.body, true);
  if (errMsg) return badRequest(res, errMsg);

  const { NomAdh, PrenAdh, DateNaissAdh, LieuNaissAdh, EmailAdh, AdrAdh,
          IdRole, DateAdhesion, TelAdh, FonctionAdh, Profession,
          Nationalite, CodePays, NumCNI, Sexe } = req.body;
  // Un gestionnaire ne peut créer un adhérent que sous sa propre organisation
  const NumAgr = req.user.role === 'gestionnaire' ? req.user.NumAgr : req.body.NumAgr;

  try {
    const org = await OrganisationRepository.findByIdFull(NumAgr);
    if (!org) return badRequest(res, 'Organisation introuvable');

    const NumAdherent = await AdherentRepository.generateNumAdherent(NumAgr);
    const Photo = req.file ? `/uploads/adherents/photos/${req.file.filename}` : null;
    const today = new Date().toISOString().split('T')[0];

    const result = await AdherentRepository.create({
      NomAdh: NomAdh.trim(), PrenAdh: PrenAdh || null,
      DateNaissAdh: DateNaissAdh || null, LieuNaissAdh: LieuNaissAdh || null, EmailAdh: EmailAdh || null,
      AdrAdh: AdrAdh || null, NumAgr,
      IdRole: IdRole ? parseInt(IdRole) : null,
      IdStatut: 4,
      DateAdhesion: DateAdhesion || today,
      TelAdh: TelAdh || null, FonctionAdh: FonctionAdh || null,
      Profession: Profession || null, Nationalite: Nationalite || null,
      CodePays: CodePays || null, NumCNI: NumCNI || null,
      Sexe: Sexe || null,
      Photo, NumAdherent,
    });

    const idAdh = result.insertId;

    if (EmailAdh) {
      const tpl = emailSvc.tplConfirmation({ NomAdh, PrenAdh, NumAdherent }, org);
      emailSvc.sendEmail({ to: EmailAdh, ...tpl, idAdh }).catch(() => {});
    }

    created(res, { message: 'Adhérent créé en attente de validation', idAdh, NumAdherent });
  } catch (err) { serverError(res, err); }
});

// ── PUT /api/adherents/:id ─────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  const errMsg = validate(req.body, false);
  if (errMsg) return badRequest(res, errMsg);

  const { NomAdh, PrenAdh, DateNaissAdh, LieuNaissAdh, EmailAdh, AdrAdh, NumAgr,
          IdRole, DateAdhesion, TelAdh, FonctionAdh, Profession,
          Nationalite, CodePays, NumCNI, Sexe } = req.body;

  try {
    const existing = await AdherentRepository.findByIdFull(req.params.id);
    if (!existing) return notFound(res, 'Adhérent non trouvé');
    if (!isOwnAdh(req, existing)) return forbidden(res, 'Cet adhérent ne concerne pas votre organisation');

    // Seul l'admin peut transférer un adhérent vers une autre organisation
    const targetNumAgr = req.user.role === 'admin' ? (NumAgr || existing.NumAgr) : existing.NumAgr;
    await AdherentRepository.update(req.params.id, {
      NomAdh: NomAdh ? NomAdh.trim() : existing.NomAdh,
      PrenAdh: PrenAdh || null, DateNaissAdh: DateNaissAdh || null, LieuNaissAdh: LieuNaissAdh || null,
      EmailAdh: EmailAdh || null, AdrAdh: AdrAdh || null,
      NumAgr: targetNumAgr,
      IdRole: IdRole ? parseInt(IdRole) : null,
      DateAdhesion: DateAdhesion || null,
      TelAdh: TelAdh || null, FonctionAdh: FonctionAdh || null,
      Profession: Profession || null, Nationalite: Nationalite || null,
      CodePays: CodePays || null, NumCNI: NumCNI || null,
      Sexe: Sexe || null,
    });
    ok(res, { message: 'Adhérent mis à jour' });
  } catch (err) { serverError(res, err); }
});

// ── POST /api/adherents/:id/photo ──────────────────────────────
router.post('/:id/photo', auth, uploadPhoto.single('photo'), async (req, res) => {
  if (!req.file) return badRequest(res, 'Photo requise (jpg/png/webp, max 5 MB)');
  try {
    const adh = await AdherentRepository.findByIdFull(req.params.id);
    if (!adh) return notFound(res, 'Adhérent non trouvé');
    if (!isOwnAdh(req, adh)) return forbidden(res, 'Cet adhérent ne concerne pas votre organisation');

    if (adh.Photo) {
      const fp = path.join(__dirname, '../public', adh.Photo);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    const Photo = `/uploads/adherents/photos/${req.file.filename}`;
    await AdherentRepository.update(req.params.id, { Photo });
    ok(res, { message: 'Photo mise à jour', Photo });
  } catch (err) { serverError(res, err); }
});

// ── POST /api/adherents/:id/statut ────────────────────────────
router.post('/:id/statut', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const adh = await AdherentRepository.findByIdFull(req.params.id);
    if (!adh) return notFound(res, 'Adhérent non trouvé');
    if (!isOwnAdh(req, adh)) return forbidden(res, 'Cet adhérent ne concerne pas votre organisation');

    const { action, motif } = req.body;
    const transition = (TRANSITIONS[adh.IdStatut] || []).find(t => t.action === action);
    if (!transition) return badRequest(res, `Transition '${action}' non autorisée depuis le statut actuel`);
    if (action === 'refuser' && !motif) return badRequest(res, 'Le motif de refus est obligatoire');

    const updates = { IdStatut: transition.to };
    if (motif) updates.MotifRefus = motif;
    await AdherentRepository.update(req.params.id, updates);

    if (adh.EmailAdh && transition.email) {
      const org = await OrganisationRepository.findByIdFull(adh.NumAgr);
      const orgObj = org || { LibOrg: adh.LibOrg || adh.NumAgr };
      if (transition.email === 'bienvenue') {
        const tpl = emailSvc.tplBienvenue(adh, orgObj);
        emailSvc.sendEmail({ to: adh.EmailAdh, ...tpl, idAdh: adh.idAdh }).catch(() => {});
      } else if (transition.email === 'refus') {
        const tpl = emailSvc.tplRefus(adh, orgObj, motif);
        emailSvc.sendEmail({ to: adh.EmailAdh, ...tpl, idAdh: adh.idAdh }).catch(() => {});
      }
    }

    ok(res, { message: 'Statut mis à jour', IdStatut: transition.to });
  } catch (err) { serverError(res, err); }
});

// ── GET /api/adherents/:id/carte ──────────────────────────────
router.get('/:id/carte', auth, async (req, res) => {
  try {
    const adh = await AdherentRepository.findByIdFull(req.params.id);
    if (!adh) return notFound(res, 'Adhérent non trouvé');
    if (!isOwnAdh(req, adh)) return forbidden(res, 'Cet adhérent ne concerne pas votre organisation');

    // Le QR code encode une vraie URL (pas un simple identifiant) — scannée avec n'importe
    // quel appareil photo, elle ouvre directement la fiche de vérification publique de l'adhérent.
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const qrCode = adh.NumAdherent || `GPO-ADH-${adh.idAdh}`;
    const qrData = `${appUrl}/verifier-adherent?code=${encodeURIComponent(qrCode)}`;
    const qrUrl  = await qrcode.toDataURL(qrData, { width: 220, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } });

    const dateExpiration = adh.DateAdhesion
      ? new Date(new Date(adh.DateAdhesion).setFullYear(new Date(adh.DateAdhesion).getFullYear() + 1))
      : null;

    const html = buildCarteOfficielle({
      type: 'adherent',
      orgName: adh.LibOrg || 'SoliDev',
      orgLogoUrl: adh.OrgLogo || null,
      roleLabel: adh.LibRole || adh.FonctionAdh || 'Membre',
      idCode: adh.NumAdherent,
      nom: adh.NomAdh,
      prenom: adh.PrenAdh,
      dateNaissance: adh.DateNaissAdh,
      sexe: adh.Sexe,
      lieuNaissance: adh.LieuNaissAdh,
      photoUrl: adh.Photo,
      initiales: ((adh.PrenAdh || adh.NomAdh || '?')[0] || '?').toUpperCase(),
      qrDataUrl: qrUrl,
      dateEtablissement: adh.DateAdhesion,
      dateExpiration,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { serverError(res, err); }
});

// ── GET /api/adherents/:id/documents ──────────────────────────
router.get('/:id/documents', auth, async (req, res) => {
  try {
    if (req.user.role === 'gestionnaire') {
      const adh = await AdherentRepository.findByIdFull(req.params.id);
      if (!adh || !isOwnAdh(req, adh)) return forbidden(res, 'Cet adhérent ne concerne pas votre organisation');
    }
    ok(res, await AdherentRepository.getDocuments(req.params.id));
  } catch (err) { serverError(res, err); }
});

// ── POST /api/adherents/:id/documents ─────────────────────────
router.post('/:id/documents', auth, uploadDoc.single('fichier'), async (req, res) => {
  if (!req.file) return badRequest(res, 'Fichier requis (pdf/jpg/png/doc, max 10 MB)');
  const { LibDocAdh, TypeDocAdh } = req.body;
  if (!LibDocAdh || !LibDocAdh.trim()) return badRequest(res, 'Nom du document requis');

  try {
    const adh = await AdherentRepository.findByIdFull(req.params.id);
    if (!adh) return notFound(res, 'Adhérent non trouvé');
    if (!isOwnAdh(req, adh)) return forbidden(res, 'Cet adhérent ne concerne pas votre organisation');

    const CheminFichier = `/uploads/adherents/docs/${req.file.filename}`;
    const id = await AdherentRepository.addDocument({
      LibDocAdh: LibDocAdh.trim(), TypeDocAdh: TypeDocAdh || 'Autre',
      CheminFichier, idAdh: parseInt(req.params.id),
      DateDocument: new Date().toISOString().split('T')[0],
    });
    created(res, { message: 'Document ajouté', id, CheminFichier });
  } catch (err) { serverError(res, err); }
});

// ── DELETE /api/adherents/:id/documents/:docId ────────────────
router.delete('/:id/documents/:docId', auth, async (req, res) => {
  try {
    if (req.user.role === 'gestionnaire') {
      const adh = await AdherentRepository.findByIdFull(req.params.id);
      if (!adh || !isOwnAdh(req, adh)) return forbidden(res, 'Cet adhérent ne concerne pas votre organisation');
    }
    const doc = await AdherentRepository.getDocumentById(req.params.docId, req.params.id);
    if (!doc) return notFound(res, 'Document non trouvé');

    const fp = path.join(__dirname, '../public', doc.CheminFichier);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    await AdherentRepository.deleteDocument(req.params.docId);
    ok(res, { message: 'Document supprimé' });
  } catch (err) { serverError(res, err); }
});

// ── POST /api/adherents/:id/paiements ─────────────────────────
router.post('/:id/paiements', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  const { MontantPaiement, TypePaiement, DatePaiement, Reference, CodeDevise, NotePaiement } = req.body;
  if (!MontantPaiement || isNaN(parseFloat(MontantPaiement)) || parseFloat(MontantPaiement) <= 0)
    return badRequest(res, 'Montant invalide (nombre positif requis)');

  try {
    const adh = await AdherentRepository.findByIdFull(req.params.id);
    if (!adh) return notFound(res, 'Adhérent non trouvé');
    if (!isOwnAdh(req, adh)) return forbidden(res, 'Cet adhérent ne concerne pas votre organisation');

    const id = await AdherentRepository.addPaiement({
      idAdh: parseInt(req.params.id),
      MontantPaiement: parseFloat(MontantPaiement),
      TypePaiement, DatePaiement: DatePaiement || new Date().toISOString().split('T')[0],
      Reference, CodeDevise, NotePaiement, NumAgr: adh.NumAgr,
    });
    created(res, { message: 'Paiement enregistré', id });
  } catch (err) { serverError(res, err); }
});

// ── DELETE /api/adherents/:id ─────────────────────────────────
router.delete('/:id', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    const adh = await AdherentRepository.findByIdFull(req.params.id);
    if (!adh) return notFound(res, 'Adhérent non trouvé');
    if (!isOwnAdh(req, adh)) return forbidden(res, 'Cet adhérent ne concerne pas votre organisation');
    if (!PurgeService.STATUTS_SUPPRIMABLES.includes(adh.IdStatut))
      return badRequest(res, "Seul un adhérent suspendu ou clôturé peut être supprimé définitivement.");
    PurgeService.purgerAdherent(req.params.id);
    ok(res, { message: 'Adhérent supprimé définitivement, avec toutes ses données (paiements, bénéficiaires, compte de connexion...)' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
