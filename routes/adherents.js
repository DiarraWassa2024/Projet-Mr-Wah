const router  = require('express').Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const qrcode  = require('qrcode');
const auth    = require('../middleware/auth');
const AdherentRepository     = require('../repositories/AdherentRepository');
const OrganisationRepository = require('../repositories/OrganisationRepository');
const emailSvc = require('../services/EmailService');
const { ok, created, notFound, badRequest, serverError } = require('../helpers/response');

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
    if (d > new Date())     return 'La date de naissance ne peut pas être dans le futur';
    const ageAns = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (ageAns < 16) return "L'adhérent doit avoir au moins 16 ans";
  }
  return null;
}

// ── GET /api/adherents ─────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    ok(res, await AdherentRepository.findAll(req.query));
  } catch (err) { serverError(res, err); }
});

// ── GET /api/adherents/:id ─────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const adh = await AdherentRepository.findByIdFull(req.params.id);
    if (!adh) return notFound(res, 'Adhérent non trouvé');
    ok(res, adh);
  } catch (err) { serverError(res, err); }
});

// ── POST /api/adherents ────────────────────────────────────────
router.post('/', auth, uploadPhoto.single('photo'), async (req, res) => {
  const errMsg = validate(req.body, true);
  if (errMsg) return badRequest(res, errMsg);

  const { NomAdh, PrenAdh, DateNaissAdh, EmailAdh, AdrAdh, NumAgr,
          IdRole, DateAdhesion, TelAdh, FonctionAdh, Profession,
          Nationalite, CodePays, NumCNI, Sexe } = req.body;

  try {
    const org = await OrganisationRepository.findByIdFull(NumAgr);
    if (!org) return badRequest(res, 'Organisation introuvable');

    const NumAdherent = await AdherentRepository.generateNumAdherent(NumAgr);
    const Photo = req.file ? `/uploads/adherents/photos/${req.file.filename}` : null;
    const today = new Date().toISOString().split('T')[0];

    const result = await AdherentRepository.create({
      NomAdh: NomAdh.trim(), PrenAdh: PrenAdh || null,
      DateNaissAdh: DateNaissAdh || null, EmailAdh: EmailAdh || null,
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

  const { NomAdh, PrenAdh, DateNaissAdh, EmailAdh, AdrAdh, NumAgr,
          IdRole, DateAdhesion, TelAdh, FonctionAdh, Profession,
          Nationalite, CodePays, NumCNI, Sexe } = req.body;

  try {
    const existing = await AdherentRepository.findByIdFull(req.params.id);
    if (!existing) return notFound(res, 'Adhérent non trouvé');

    await AdherentRepository.update(req.params.id, {
      NomAdh: NomAdh ? NomAdh.trim() : existing.NomAdh,
      PrenAdh: PrenAdh || null, DateNaissAdh: DateNaissAdh || null,
      EmailAdh: EmailAdh || null, AdrAdh: AdrAdh || null,
      NumAgr: NumAgr || existing.NumAgr,
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
router.post('/:id/statut', auth, async (req, res) => {
  try {
    const adh = await AdherentRepository.findByIdFull(req.params.id);
    if (!adh) return notFound(res, 'Adhérent non trouvé');

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

    const qrData = adh.NumAdherent || `GPO-ADH-${adh.idAdh}`;
    const qrUrl  = await qrcode.toDataURL(qrData, { width: 180, margin: 1, color: { dark: '#1e3a5f', light: '#ffffff' } });

    const photoHtml = adh.Photo
      ? `<img src="${adh.Photo}" class="card-photo" alt="photo">`
      : `<div class="card-photo card-initial">${((adh.PrenAdh || adh.NomAdh || '?')[0]).toUpperCase()}</div>`;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Carte — ${adh.NumAdherent || adh.idAdh}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#e5e7eb;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:'Segoe UI',Arial,sans-serif;gap:20px}
  .card{width:360px;height:220px;border-radius:18px;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.28);position:relative}
  .card-bg{width:100%;height:100%;background:linear-gradient(135deg,#1e3a5f 0%,#1a56db 55%,#312e81 100%);padding:20px 22px;display:flex;flex-direction:column;color:#fff}
  .card-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}
  .card-org{font-size:9px;text-transform:uppercase;letter-spacing:2px;opacity:.75;max-width:200px;line-height:1.4}
  .card-logo{font-size:20px}
  .card-main{display:flex;gap:16px;flex:1;align-items:center}
  .card-photo{width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,.4);flex-shrink:0}
  .card-initial{display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;background:rgba(255,255,255,.2)}
  .card-info{flex:1;min-width:0}
  .card-name{font-size:16px;font-weight:700;line-height:1.2;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-role{font-size:10px;opacity:.8;margin-bottom:8px}
  .card-id{font-family:monospace;font-size:12px;background:rgba(255,255,255,.18);padding:5px 10px;border-radius:6px;letter-spacing:1.5px;display:inline-block}
  .card-footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:12px}
  .card-meta{font-size:9px;opacity:.65;line-height:1.7}
  .card-qr{background:#fff;border-radius:8px;padding:3px;display:flex}
  .card-qr img{display:block}
  .actions{display:flex;gap:10px}
  .btn{padding:10px 24px;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600}
  .btn-print{background:#1a56db;color:#fff}
  .btn-close{background:#e5e7eb;color:#374151}
  @media print{body{background:none;justify-content:flex-start;padding:20px}.card{box-shadow:none}.actions{display:none}}
</style>
</head>
<body>
<div class="card">
  <div class="card-bg">
    <div class="card-header">
      <div class="card-org">SoliDev<br>${(adh.LibOrg || 'Organisation').substring(0, 30)}</div>
      <div class="card-logo">🌍</div>
    </div>
    <div class="card-main">
      ${photoHtml}
      <div class="card-info">
        <div class="card-name">${adh.PrenAdh ? adh.PrenAdh + ' ' : ''}${adh.NomAdh}</div>
        <div class="card-role">${adh.LibRole || 'Membre'}${adh.FonctionAdh ? ' · ' + adh.FonctionAdh : ''}</div>
        <div class="card-id">${adh.NumAdherent || '—'}</div>
      </div>
      <div class="card-qr"><img src="${qrUrl}" width="58" height="58" alt="QR"></div>
    </div>
    <div class="card-footer">
      <div class="card-meta">
        Adhésion : ${adh.DateAdhesion ? new Date(adh.DateAdhesion).toLocaleDateString('fr-FR') : '—'}<br>
        ${adh.Sexe ? adh.Sexe + (adh.Profession ? ' · ' + adh.Profession : '') : (adh.Profession || '')}
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

// ── GET /api/adherents/:id/documents ──────────────────────────
router.get('/:id/documents', auth, async (req, res) => {
  try {
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
    const doc = await AdherentRepository.getDocumentById(req.params.docId, req.params.id);
    if (!doc) return notFound(res, 'Document non trouvé');

    const fp = path.join(__dirname, '../public', doc.CheminFichier);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    await AdherentRepository.deleteDocument(req.params.docId);
    ok(res, { message: 'Document supprimé' });
  } catch (err) { serverError(res, err); }
});

// ── POST /api/adherents/:id/paiements ─────────────────────────
router.post('/:id/paiements', auth, async (req, res) => {
  const { MontantPaiement, TypePaiement, DatePaiement, Reference, CodeDevise, NotePaiement } = req.body;
  if (!MontantPaiement || isNaN(parseFloat(MontantPaiement)) || parseFloat(MontantPaiement) <= 0)
    return badRequest(res, 'Montant invalide (nombre positif requis)');

  try {
    const adh = await AdherentRepository.findByIdFull(req.params.id);
    if (!adh) return notFound(res, 'Adhérent non trouvé');

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
router.delete('/:id', auth, async (req, res) => {
  try {
    const adh = await AdherentRepository.findByIdFull(req.params.id);
    if (!adh) return notFound(res, 'Adhérent non trouvé');
    if (adh.IdStatut === 1)
      return badRequest(res, "Impossible de supprimer un adhérent actif. Résiliez-le d'abord.");
    await AdherentRepository.delete(req.params.id);
    ok(res, { message: 'Adhérent supprimé' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
