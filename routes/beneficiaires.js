const router  = require('express').Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const qrcode  = require('qrcode');
const auth    = require('../middleware/auth');
const BeneficiaireRepository = require('../repositories/BeneficiaireRepository');
const AdherentRepository     = require('../repositories/AdherentRepository');
const db      = require('../config/database');
const { ok, created, notFound, badRequest, serverError } = require('../helpers/response');

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
    ok(res, await BeneficiaireRepository.findAll(req.query));
  } catch (err) { serverError(res, err); }
});

// ── GET /api/beneficiaires/:id ────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const benef = await BeneficiaireRepository.findByIdFull(req.params.id);
    if (!benef) return notFound(res, 'Bénéficiaire non trouvé');
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

    const qrData = b.NumBenef || `GPO-BNF-${b.idBenef}`;
    const qrUrl  = await qrcode.toDataURL(qrData, { width: 180, margin: 1, color: { dark: '#2d1b69', light: '#ffffff' } });

    const photoHtml = b.Photo
      ? `<img src="${b.Photo}" class="card-photo" alt="photo">`
      : `<div class="card-photo card-initial">${((b.PrenomBenef || b.NomBenef || '?')[0]).toUpperCase()}</div>`;

    const adhNom = [b.PrenAdh, b.NomAdh].filter(Boolean).join(' ') || '—';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Carte Bénéficiaire — ${b.NumBenef || b.idBenef}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#e5e7eb;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:'Segoe UI',Arial,sans-serif;gap:20px}
  .card{width:360px;height:220px;border-radius:18px;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.28)}
  .card-bg{width:100%;height:100%;background:linear-gradient(135deg,#2d1b69 0%,#7c3aed 55%,#5b21b6 100%);padding:20px 22px;display:flex;flex-direction:column;color:#fff}
  .card-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}
  .card-label{font-size:9px;text-transform:uppercase;letter-spacing:2px;opacity:.75;line-height:1.5}
  .card-type{font-size:20px}
  .card-main{display:flex;gap:16px;flex:1;align-items:center}
  .card-photo{width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,.4);flex-shrink:0}
  .card-initial{display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;background:rgba(255,255,255,.2)}
  .card-info{flex:1;min-width:0}
  .card-name{font-size:15px;font-weight:700;line-height:1.2;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-lien{font-size:10px;opacity:.9;margin-bottom:5px;background:rgba(255,255,255,.2);padding:2px 8px;border-radius:10px;display:inline-block}
  .card-id{font-family:monospace;font-size:10px;background:rgba(255,255,255,.18);padding:4px 8px;border-radius:6px;letter-spacing:1px;display:block;margin-bottom:3px}
  .card-adh{font-size:9px;opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:10px}
  .card-meta{font-size:9px;opacity:.65;line-height:1.6}
  .card-qr{background:#fff;border-radius:8px;padding:3px;display:flex;flex-shrink:0}
  .actions{display:flex;gap:10px}
  .btn{padding:10px 24px;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600}
  .btn-print{background:#7c3aed;color:#fff}
  .btn-close{background:#e5e7eb;color:#374151}
  @media print{body{background:none;justify-content:flex-start;padding:20px}.card{box-shadow:none}.actions{display:none}}
</style>
</head>
<body>
<div class="card">
  <div class="card-bg">
    <div class="card-header">
      <div class="card-label">SoliDev — Bénéficiaire<br>${(b.LibOrg || 'Organisation').substring(0, 28)}</div>
      <div class="card-type">🛡️</div>
    </div>
    <div class="card-main">
      ${photoHtml}
      <div class="card-info">
        <div class="card-name">${b.PrenomBenef ? b.PrenomBenef + ' ' : ''}${b.NomBenef}</div>
        <div class="card-lien">${b.LienParente || 'Bénéficiaire'}</div>
        <div class="card-id">${b.NumBenef || '—'}</div>
        <div class="card-adh">Membre : ${adhNom}${b.NumAdherent ? ' · ' + b.NumAdherent : ''}</div>
      </div>
      <div class="card-qr"><img src="${qrUrl}" width="58" height="58" alt="QR"></div>
    </div>
    <div class="card-footer">
      <div class="card-meta">
        ${b.DateNaissBenef ? 'Né(e) : ' + new Date(b.DateNaissBenef).toLocaleDateString('fr-FR') + '<br>' : ''}
        ${b.Nationalite || ''}
      </div>
    </div>
  </div>
</div>
<div class="actions">
  <button class="btn btn-print" onclick="window.print()">🖨️ Imprimer</button>
  <button class="btn btn-close" onclick="window.close()">Fermer</button>
</div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { serverError(res, err); }
});

// ── DELETE /api/beneficiaires/:id ─────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const benef = await BeneficiaireRepository.findByIdFull(req.params.id);
    if (!benef) return notFound(res, 'Bénéficiaire non trouvé');

    if (benef.Photo) {
      const fp = path.join(__dirname, '../public', benef.Photo);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await BeneficiaireRepository.delete(req.params.id);
    ok(res, { message: 'Bénéficiaire supprimé' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
