const router  = require('express').Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const qrcode  = require('qrcode');
const auth    = require('../middleware/auth');
const BeneficiaireRepository = require('../repositories/BeneficiaireRepository');
const AdherentRepository     = require('../repositories/AdherentRepository');
const db      = require('../config/database');
const { ok, created, notFound, badRequest, forbidden, serverError } = require('../helpers/response');
const { buildCarteOfficielle } = require('../helpers/carteTemplate');

/**
 * Un gestionnaire gère les bénéficiaires de sa propre organisation ; un adhérent ne voit/modifie
 * que SES PROPRES bénéficiaires (rattachés à son idAdh) ; l'admin voit et modifie tout.
 */
function isOwnBenef(req, benef) {
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'gestionnaire') return !!(benef && benef.NumAgr === req.user.NumAgr);
  if (req.user.role === 'adherent') return !!(benef && benef.idAdh === req.user.idAdh);
  return false;
}

// ── Multer — photos bénéficiaires ─────────────────────────────
const photoDir = path.join(__dirname, '../public/uploads/beneficiaires/photos');
if (!fs.existsSync(photoDir)) fs.mkdirSync(photoDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, photoDir),
  filename:    (req, file, cb) => cb(null, `benef_${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
});
const uploadPhoto = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file.originalname).toLowerCase()));
  },
});

// ── Validation ─────────────────────────────────────────────────
function validate(body, isCreate) {
  if (!body.NomBenef || body.NomBenef.trim().length < 2)
    return 'Le nom est obligatoire (minimum 2 caractères)';
  if (body.NomBenef.trim().length > 100)
    return 'Le nom ne peut dépasser 100 caractères';
  if (isCreate && !body.idAdh)
    return "L'adhérent est obligatoire";
  if (body.EmailBenef && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.EmailBenef))
    return 'Email invalide';
  if (body.TelBenef && body.TelBenef.replace(/\s/g, '').length < 8)
    return 'Numéro de téléphone trop court (8 chiffres minimum)';
  if (body.DateNaissBenef) {
    const d = new Date(body.DateNaissBenef);
    if (isNaN(d.getTime())) return 'Date de naissance invalide';
    if (d > new Date())     return 'La date de naissance ne peut pas être dans le futur';
  }
  return null;
}

// ── GET /api/beneficiaires ─────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const query = { ...req.query };
    if (req.user.role === 'gestionnaire') query.org = req.user.NumAgr;
    if (req.user.role === 'adherent') query.adherent = req.user.idAdh;
    ok(res, await BeneficiaireRepository.findAll(query));
  } catch (err) { serverError(res, err); }
});

// ── GET /api/beneficiaires/:id ────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const benef = await BeneficiaireRepository.findByIdFull(req.params.id);
    if (!benef) return notFound(res, 'Bénéficiaire non trouvé');
    if (!isOwnBenef(req, benef)) return forbidden(res, 'Ce bénéficiaire ne concerne pas votre organisation');
    ok(res, benef);
  } catch (err) { serverError(res, err); }
});

// ── POST /api/beneficiaires ────────────────────────────────────
router.post('/', auth, uploadPhoto.single('photo'), async (req, res) => {
  const errMsg = validate(req.body, true);
  if (errMsg) return badRequest(res, errMsg);

  const { NomBenef, PrenomBenef, DateNaissBenef, EmailBenef, TelBenef,
          LienParente, idAdh, TypeBenef, Observations,
          NumCNI, Nationalite, CodePays } = req.body;

  try {
    const adh = await AdherentRepository.findByIdFull(parseInt(idAdh));
    if (!adh) return badRequest(res, 'Adhérent introuvable');
    if (req.user.role === 'gestionnaire' && adh.NumAgr !== req.user.NumAgr)
      return forbidden(res, 'Cet adhérent ne concerne pas votre organisation');
    if (req.user.role === 'adherent' && adh.idAdh !== req.user.idAdh)
      return forbidden(res, 'Vous ne pouvez ajouter un bénéficiaire que sous votre propre fiche adhérent');
    if (!adh.NumAdherent)
      return badRequest(res, "Cet adhérent n'a pas encore d'identifiant généré. Validez d'abord son adhésion.");

    const count = await BeneficiaireRepository.countByAdherent(parseInt(idAdh));
    if (count >= 10)
      return badRequest(res, 'Limite de 10 bénéficiaires par adhérent atteinte');

    const NumBenef = await BeneficiaireRepository.generateNumBenef(adh.NumAdherent);
    const Photo    = req.file ? `/uploads/beneficiaires/photos/${req.file.filename}` : null;

    // GPOTB06_Beneficiaire.idPers is NOT NULL — create a Personne shell
    const persStmt = db.raw.prepare(
      `INSERT INTO GPOTB04_Personne (NomPers, PrenomPers, EmailPers, TelPers, DateNaissPers, CodePays)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const persResult = persStmt.run(
      NomBenef.trim(),
      PrenomBenef || null,
      EmailBenef  || null,
      TelBenef    || null,
      DateNaissBenef || null,
      CodePays    || null
    );
    const idPers = persResult.lastInsertRowid;

    const result = await BeneficiaireRepository.create({
      idPers,
      NomBenef:       NomBenef.trim(),
      PrenomBenef:    PrenomBenef    || null,
      DateNaissBenef: DateNaissBenef || null,
      EmailBenef:     EmailBenef     || null,
      TelBenef:       TelBenef       || null,
      LienParente:    LienParente    || 'Autre',
      idAdh:          parseInt(idAdh),
      NumAgr:         adh.NumAgr,
      TypeBenef:      TypeBenef      || 'Personne',
      Observations:   Observations   || null,
      NumCNI:         NumCNI         || null,
      Nationalite:    Nationalite    || null,
      CodePays:       CodePays       || null,
      IdStatut:       1,
      NumBenef,
      Photo,
    });

    created(res, { message: 'Bénéficiaire créé', idBenef: result.insertId, NumBenef });
  } catch (err) { serverError(res, err); }
});

// ── PUT /api/beneficiaires/:id ────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  const errMsg = validate(req.body, false);
  if (errMsg) return badRequest(res, errMsg);

  const { NomBenef, PrenomBenef, DateNaissBenef, EmailBenef, TelBenef,
          LienParente, TypeBenef, Observations, NumCNI, Nationalite, CodePays, IdStatut } = req.body;

  try {
    const existing = await BeneficiaireRepository.findByIdFull(req.params.id);
    if (!existing) return notFound(res, 'Bénéficiaire non trouvé');
    if (!isOwnBenef(req, existing)) return forbidden(res, 'Ce bénéficiaire ne concerne pas votre organisation');

    await BeneficiaireRepository.update(req.params.id, {
      NomBenef:       NomBenef ? NomBenef.trim() : existing.NomBenef,
      PrenomBenef:    PrenomBenef    || null,
      DateNaissBenef: DateNaissBenef || null,
      EmailBenef:     EmailBenef     || null,
      TelBenef:       TelBenef       || null,
      LienParente:    LienParente    || 'Autre',
      TypeBenef:      TypeBenef      || 'Personne',
      Observations:   Observations   || null,
      NumCNI:         NumCNI         || null,
      Nationalite:    Nationalite    || null,
      CodePays:       CodePays       || null,
      IdStatut:       IdStatut ? parseInt(IdStatut) : existing.IdStatut,
    });
    ok(res, { message: 'Bénéficiaire mis à jour' });
  } catch (err) { serverError(res, err); }
});

// ── POST /api/beneficiaires/:id/photo ─────────────────────────
router.post('/:id/photo', auth, uploadPhoto.single('photo'), async (req, res) => {
  if (!req.file) return badRequest(res, 'Photo requise (jpg/png/webp, max 5 Mo)');
  try {
    const benef = await BeneficiaireRepository.findByIdFull(req.params.id);
    if (!benef) return notFound(res, 'Bénéficiaire non trouvé');
    if (!isOwnBenef(req, benef)) return forbidden(res, 'Ce bénéficiaire ne concerne pas votre organisation');

    if (benef.Photo) {
      const fp = path.join(__dirname, '../public', benef.Photo);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    const Photo = `/uploads/beneficiaires/photos/${req.file.filename}`;
    await BeneficiaireRepository.update(req.params.id, { Photo });
    ok(res, { message: 'Photo mise à jour', Photo });
  } catch (err) { serverError(res, err); }
});

// ── GET /api/beneficiaires/:id/carte ─────────────────────────
router.get('/:id/carte', auth, async (req, res) => {
  try {
    const b = await BeneficiaireRepository.findByIdFull(req.params.id);
    if (!b) return notFound(res, 'Bénéficiaire non trouvé');
    if (!isOwnBenef(req, b)) return forbidden(res, 'Ce bénéficiaire ne concerne pas votre organisation');

    const qrData = b.NumBenef || `GPO-BNF-${b.idBenef}`;
    const qrUrl  = await qrcode.toDataURL(qrData, { width: 220, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } });

    const adhNom = [b.PrenAdh, b.NomAdh].filter(Boolean).join(' ') + (b.NumAdherent ? ` (${b.NumAdherent})` : '');
    const dateExpiration = b.DateAdhesion
      ? new Date(new Date(b.DateAdhesion).setFullYear(new Date(b.DateAdhesion).getFullYear() + 1))
      : null;

    const html = buildCarteOfficielle({
      type: 'beneficiaire',
      orgName: b.LibOrg || 'SoliDev',
      orgLogoUrl: b.OrgLogo || null,
      roleLabel: b.LienParente || 'Bénéficiaire',
      idCode: b.NumBenef,
      nom: b.NomBenef,
      prenom: b.PrenomBenef,
      dateNaissance: b.DateNaissBenef,
      lienAdherent: adhNom,
      photoUrl: b.Photo,
      initiales: ((b.PrenomBenef || b.NomBenef || '?')[0] || '?').toUpperCase(),
      qrDataUrl: qrUrl,
      dateEtablissement: b.DateAdhesion,
      dateExpiration,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { serverError(res, err); }
});

// ── DELETE /api/beneficiaires/:id ─────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const benef = await BeneficiaireRepository.findByIdFull(req.params.id);
    if (!benef) return notFound(res, 'Bénéficiaire non trouvé');
    if (!isOwnBenef(req, benef)) return forbidden(res, 'Ce bénéficiaire ne concerne pas votre organisation');

    if (benef.Photo) {
      const fp = path.join(__dirname, '../public', benef.Photo);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await BeneficiaireRepository.delete(req.params.id);
    ok(res, { message: 'Bénéficiaire supprimé' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
