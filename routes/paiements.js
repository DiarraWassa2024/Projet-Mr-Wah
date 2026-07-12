const router             = require('express').Router();
const auth               = require('../middleware/auth');
const roles              = require('../middleware/roles');
const PaiementRepository = require('../repositories/PaiementRepository');
const PaymentService     = require('../services/payment/PaymentService');
const DemandeService     = require('../services/DemandeService');
const PAYMENT_PROVIDERS  = require('../config/paymentProviders');
const { todayDate }      = require('../helpers/dateHelper');
const { ok, created, badRequest, notFound, serverError } = require('../helpers/response');

const STATUTS_VALID = ['En attente','Payé','Impayé','Validé','Rejeté','Remboursé'];

function genNumRecu(id) {
  const d = new Date();
  return `PAY-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}-${String(id).padStart(5,'0')}`;
}

/* ── GET /api/paiements/stats ─────────────────────────────── */
router.get('/stats', auth, async (req, res) => {
  try { ok(res, await PaiementRepository.stats(req.query)); }
  catch(err) { serverError(res, err); }
});

/* ── GET /api/paiements/operateurs/:codePays ──────────────── */
/* Liste des opérateurs mobile money disponibles pour un pays (sélection auto). */
router.get('/operateurs/:codePays', auth, async (req, res) => {
  const cfg = PaymentService.getOperateurs(req.params.codePays);
  if (!cfg) return notFound(res, 'Aucun opérateur disponible pour ce pays');
  ok(res, cfg);
});

/* ── GET /api/paiements/mon-paiement-attente ───────────────── */
/* Paiement d'adhésion en attente pour l'utilisateur connecté (gate post-connexion). */
router.get('/mon-paiement-attente', auth, async (req, res) => {
  try {
    const { NumAgr, idAdh } = req.user;
    if (!NumAgr && !idAdh) return ok(res, null);

    const rows = await PaiementRepository.query(`
      SELECT pa.*, d.LibDevise, d.Symbole AS SymDevise
      FROM GPOTB08_Paiement pa
      LEFT JOIN GPOTB27_Devise d ON pa.CodeDevise = d.CodeDevise
      WHERE pa.TypePaiement = 'Adhésion' AND pa.Statut = 'En attente'
        AND ((pa.idAdh = ? AND ? IS NOT NULL) OR (pa.NumAgr = ? AND ? IS NOT NULL))
      ORDER BY pa.IdPaiement DESC LIMIT 1
    `, [idAdh || null, idAdh || null, NumAgr || null, NumAgr || null]);

    ok(res, rows[0] || null);
  } catch (err) { serverError(res, err); }
});

/* ── POST /api/paiements/:id/payer ─────────────────────────── */
/* Déclenche le paiement (simulé) via l'opérateur choisi. */
router.post('/:id/payer', auth, async (req, res) => {
  try {
    // Un utilisateur non-admin ne peut régler que son propre paiement en attente
    if (req.user.role !== 'admin') {
      const pay = await PaiementRepository.findById(req.params.id);
      const isOwner = pay && (
        (req.user.idAdh && pay.idAdh === req.user.idAdh) ||
        (req.user.NumAgr && pay.NumAgr === req.user.NumAgr)
      );
      if (!isOwner) return res.status(403).json({ message: 'Ce paiement ne vous appartient pas' });
    }

    const result = await PaymentService.payer(req.params.id, req.body);
    if (result.success && result.idDemande) {
      await DemandeService.completerApresPaiement(result.idDemande).catch(e => console.error('[Adhesion] activation:', e.message));
    }
    ok(res, result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    serverError(res, err);
  }
});

/* ── GET /api/paiements ───────────────────────────────────── */
router.get('/', auth, async (req, res) => {
  try { ok(res, await PaiementRepository.findAll(req.query)); }
  catch(err) { serverError(res, err); }
});

/* ── GET /api/paiements/:id ───────────────────────────────── */
router.get('/:id', auth, async (req, res) => {
  try {
    const row = await PaiementRepository.findByIdFull(req.params.id);
    if (!row) return res.status(404).json({ message: 'Paiement introuvable' });
    ok(res, row);
  } catch(err) { serverError(res, err); }
});

/* ── POST /api/paiements ──────────────────────────────────── */
router.post('/', auth, async (req, res) => {
  try {
    const {
      DatePaiement, MontantPaiement, Statut, TypePaiement,
      idAdh, IdMoyPay, NumAgr, Reference, CodeDevise, CodePays,
      NotePaiement, DateEcheance, ObjetPaiement, sendEmail: doEmail,
    } = req.body;

    if (!MontantPaiement)    return badRequest(res, 'Montant obligatoire');
    if (!NumAgr && !idAdh)   return badRequest(res, 'Organisation ou adhérent obligatoire');

    const deviseParDefaut = CodePays && PAYMENT_PROVIDERS[CodePays] ? PAYMENT_PROVIDERS[CodePays].devise : 'XOF';

    const result = await PaiementRepository.create({
      DatePaiement:    DatePaiement || todayDate(),
      MontantPaiement: Number(MontantPaiement),
      Statut:          Statut || 'En attente',
      TypePaiement:    TypePaiement || 'Cotisation',
      idAdh:           idAdh    || null,
      IdMoyPay:        IdMoyPay || null,
      NumAgr:          NumAgr   || null,
      CodeDevise:      CodeDevise || deviseParDefaut,
      CodePays:        CodePays || null,
      Reference:       Reference || null,
      NotePaiement:    NotePaiement || null,
      DateEcheance:    DateEcheance || null,
      ObjetPaiement:   ObjetPaiement || null,
      EmailEnvoye:     0,
    });

    const id = result.insertId;
    const numRecu = genNumRecu(id);
    await PaiementRepository.update(id, { NumRecu: numRecu });

    if (doEmail && idAdh) {
      try {
        const pay = await PaiementRepository.findByIdFull(id);
        if (pay?.EmailAdh) {
          await envoyerEmailPaiement(pay, 'creation');
          await PaiementRepository.update(id, { EmailEnvoye: 1 });
        }
      } catch(e) { console.error('[Paiement] email:', e.message); }
    }

    created(res, { id, numRecu, message: 'Paiement enregistré' });
  } catch(err) { serverError(res, err); }
});

/* ── PUT /api/paiements/:id ───────────────────────────────── */
router.put('/:id', auth, async (req, res) => {
  try {
    const { DatePaiement, MontantPaiement, Statut, TypePaiement, idAdh, IdMoyPay,
            NumAgr, Reference, CodeDevise, CodePays, NotePaiement, DateEcheance, ObjetPaiement } = req.body;
    if (!MontantPaiement) return badRequest(res, 'Montant obligatoire');
    await PaiementRepository.updatePaiement(req.params.id, {
      DatePaiement, MontantPaiement, Statut, TypePaiement,
      idAdh, IdMoyPay, NumAgr, Reference, CodeDevise, CodePays,
      NotePaiement, DateEcheance, ObjetPaiement,
    });
    ok(res, { message: 'Paiement mis à jour' });
  } catch(err) { serverError(res, err); }
});

/* ── PUT /api/paiements/:id/statut ───────────────────────── */
router.put('/:id/statut', auth, roles('admin','gestionnaire'), async (req, res) => {
  try {
    const { statut, sendEmail: doEmail } = req.body;
    if (!STATUTS_VALID.includes(statut)) return badRequest(res, 'Statut invalide');
    await PaiementRepository.update(req.params.id, { Statut: statut });

    if (doEmail) {
      try {
        const pay = await PaiementRepository.findByIdFull(req.params.id);
        if (pay?.EmailAdh) {
          await envoyerEmailPaiement(pay, statut);
          await PaiementRepository.update(req.params.id, { EmailEnvoye: 1 });
        }
      } catch(e) { console.error('[Paiement] email statut:', e.message); }
    }
    ok(res, { message: 'Statut mis à jour' });
  } catch(err) { serverError(res, err); }
});

/* ── POST /api/paiements/:id/email ───────────────────────── */
router.post('/:id/email', auth, roles('admin','gestionnaire'), async (req, res) => {
  try {
    const pay = await PaiementRepository.findByIdFull(req.params.id);
    if (!pay)          return res.status(404).json({ message: 'Paiement introuvable' });
    if (!pay.EmailAdh) return badRequest(res, 'Adhérent sans email');
    await envoyerEmailPaiement(pay, pay.Statut || 'creation');
    await PaiementRepository.update(req.params.id, { EmailEnvoye: 1 });
    ok(res, { message: 'Email envoyé' });
  } catch(err) { serverError(res, err); }
});

/* ── DELETE /api/paiements/:id ───────────────────────────── */
router.delete('/:id', auth, roles('admin','gestionnaire'), async (req, res) => {
  try {
    await PaiementRepository.delete(req.params.id);
    ok(res, { message: 'Paiement supprimé' });
  } catch(err) { serverError(res, err); }
});

/* ── Helper email paiement ───────────────────────────────── */
async function envoyerEmailPaiement(pay, event) {
  const { sendEmail } = require('../services/EmailService');
  const tpl = buildEmailPaiement(pay, event);
  await sendEmail({ to: pay.EmailAdh, subject: tpl.subject, html: tpl.html, text: tpl.text, idAdh: pay.idAdh });
}

function buildEmailPaiement(p, event) {
  const montant = `${Number(p.MontantPaiement).toLocaleString('fr-FR')} ${p.SymDevise || p.CodeDevise || 'FCFA'}`;
  const nom     = `${p.PrenAdh||''} ${p.NomAdh||''}`.trim() || 'Adhérent';
  const org     = p.LibOrg || '';
  const type    = p.TypePaiement || 'Paiement';
  const ref     = p.NumRecu || p.Reference || `#${p.IdPaiement}`;
  const date    = p.DatePaiement ? new Date(p.DatePaiement).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'}) : '';

  const CFG = {
    'Payé':       { c1:'#059669', c2:'#10b981', icon:'✅', titre:'Paiement confirmé',   msg:`Votre paiement de <strong>${montant}</strong> (${type}) a été <strong style="color:#059669">validé</strong>.` },
    'Impayé':     { c1:'#dc2626', c2:'#ef4444', icon:'⚠️', titre:'Relance paiement',     msg:`Votre paiement de <strong>${montant}</strong> (${type}) est en <strong style="color:#dc2626">impayé</strong>. Veuillez régulariser.` },
    'Remboursé':  { c1:'#7c3aed', c2:'#8b5cf6', icon:'↩️', titre:'Remboursement',        msg:`Un remboursement de <strong>${montant}</strong> (${type}) a été effectué.` },
    'Rejeté':     { c1:'#374151', c2:'#6b7280', icon:'❌', titre:'Paiement rejeté',       msg:`Votre paiement de <strong>${montant}</strong> (${type}) a été rejeté.` },
    'En attente': { c1:'#d97706', c2:'#f59e0b', icon:'⏳', titre:'Paiement en attente',  msg:`Votre paiement de <strong>${montant}</strong> (${type}) est en cours de traitement.` },
    'creation':   { c1:'#1e40af', c2:'#3b82f6', icon:'🎉', titre:'Paiement enregistré',  msg:`Votre paiement de <strong>${montant}</strong> (${type}) a bien été enregistré.` },
  };
  const { c1, c2, icon, titre, msg } = CFG[event] || CFG['En attente'];

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;margin:0;padding:24px}
    .card{background:#fff;border-radius:16px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.09)}
    .hdr{padding:32px 36px;color:#fff;text-align:center}
    .hdr h1{margin:0 0 6px;font-size:22px;font-weight:700}
    .hdr p{margin:0;opacity:.8;font-size:14px}
    .body{padding:32px 36px}
    .body p{margin:0 0 14px;color:#374151;line-height:1.6;font-size:14px}
    .ref-box{background:#eff6ff;border:2px solid #bfdbfe;border-radius:10px;padding:14px 20px;margin:18px 0;text-align:center}
    .ref-num{font-family:monospace;font-size:22px;font-weight:700;color:#1e40af;letter-spacing:2px}
    .details{background:#f8fafc;border-left:4px solid ${c1};padding:14px 18px;border-radius:8px;margin:18px 0;color:#374151;font-size:14px;line-height:1.9}
    .ftr{background:#f8fafc;padding:18px 36px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:12px}
    strong{color:#1e293b}
  </style></head><body><div class="card">
    <div class="hdr" style="background:linear-gradient(135deg,${c1},${c2})">
      <h1>${icon} ${titre}</h1><p>SoliDev – Plateforme Panafricaine des Associations</p>
    </div>
    <div class="body">
      <p>Bonjour <strong>${nom}</strong>,</p>
      <p>${msg}</p>
      <div class="ref-box">
        <p style="margin:0 0 6px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Référence</p>
        <div class="ref-num">${ref}</div>
      </div>
      <div class="details">
        • Montant : <strong>${montant}</strong><br>
        • Type : <strong>${type}</strong><br>
        • Organisation : <strong>${org}</strong><br>
        • Date : <strong>${date}</strong>
        ${p.DateEcheance ? `<br>• Échéance : <strong>${new Date(p.DateEcheance).toLocaleDateString('fr-FR')}</strong>` : ''}
      </div>
      <p style="color:#6b7280;font-size:13px">Pour toute question, contactez votre organisation directement.</p>
    </div>
    <div class="ftr">SoliDev · Solidarité &amp; Développement · noreply@solidev.africa</div>
  </div></body></html>`;

  return {
    subject: `${icon} ${titre} — ${org} | SoliDev`,
    html,
    text: `${titre}\n\nBonjour ${nom},\n\nRéférence: ${ref}\nMontant: ${montant}\nType: ${type}\nOrganisation: ${org}\nDate: ${date}`,
  };
}

module.exports = router;
