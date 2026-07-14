const router             = require('express').Router();
const db                  = require('../config/database');
const auth                = require('../middleware/auth');
const roles               = require('../middleware/roles');
const PaiementRepository  = require('../repositories/PaiementRepository');
const NotificationService = require('../services/NotificationService');
const { fermerOrganisation } = require('../services/OrganisationLifecycleService');
const { getTauxRemboursementPct } = require('../config/remboursement');
const { ok, badRequest, notFound, forbidden, serverError } = require('../helpers/response');

// POST /api/remboursements — demande de remboursement (rétractation) sur un paiement déjà réglé
router.post('/', auth, roles('gestionnaire', 'adherent'), async (req, res) => {
  try {
    const { idPaiement, motif } = req.body;
    if (!idPaiement) return badRequest(res, 'idPaiement requis');
    if (!motif || !motif.trim()) return badRequest(res, 'La cause du remboursement est obligatoire');

    const pay = await PaiementRepository.findByIdFull(idPaiement);
    if (!pay) return notFound(res, 'Paiement introuvable');
    if (pay.Statut !== 'Payé')
      return badRequest(res, 'Seul un paiement réglé (statut "Payé") peut faire l\'objet d\'une demande de remboursement');
    if (req.user.role === 'gestionnaire' && pay.NumAgr !== req.user.NumAgr)
      return forbidden(res, 'Ce paiement ne concerne pas votre organisation');
    if (req.user.role === 'adherent' && pay.idAdh !== req.user.idAdh)
      return forbidden(res, 'Ce paiement ne vous concerne pas');

    const [[existing]] = await db.execute(
      `SELECT idRemboursement FROM SD_Remboursement WHERE idPaiement = ? AND statut != 'Rejeté'`,
      [idPaiement]
    );
    if (existing) return badRequest(res, 'Une demande de remboursement est déjà en cours pour ce paiement');

    const [result] = await db.execute(
      `INSERT INTO SD_Remboursement (idPaiement, numAgr, idAdh, montantRembourse, motif)
       VALUES (?, ?, ?, ?, ?)`,
      [idPaiement, pay.NumAgr || null, pay.idAdh || null, pay.MontantPaiement, motif.trim()]
    );
    ok(res, { message: 'Demande de remboursement enregistrée', id: result.insertId }, 201);
  } catch (err) { serverError(res, err); }
});

// GET /api/remboursements — admin : tout ; gestionnaire : son organisation ; adhérent : les siennes
router.get('/', auth, async (req, res) => {
  try {
    let where = '1=1';
    const params = [];
    if (req.user.role === 'gestionnaire') { where += ' AND r.numAgr = ?'; params.push(req.user.NumAgr); }
    else if (req.user.role === 'adherent') { where += ' AND r.idAdh = ?'; params.push(req.user.idAdh); }

    const [rows] = await db.execute(
      `SELECT r.*, p.MontantPaiement, p.ObjetPaiement, p.CodeDevise, p.NumRecu,
              o.LibOrg, a.NomAdh, a.PrenAdh
       FROM SD_Remboursement r
       LEFT JOIN GPOTB08_Paiement p ON p.IdPaiement = r.idPaiement
       LEFT JOIN GPOTB01_Organisation o ON o.NumAgr = r.numAgr
       LEFT JOIN GPOTB02_Adherent a ON a.idAdh = r.idAdh
       WHERE ${where}
       ORDER BY r.dateDemande DESC`,
      params
    );
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// PUT /api/remboursements/:id/approuver — admin uniquement : ne rembourse pas encore, calcule
// et propose au demandeur une offre partielle (taux configurable, cf. config/remboursement.js) —
// c'est au demandeur d'accepter ou refuser cette offre (voir /accepter-offre, /refuser-offre).
router.put('/:id/approuver', auth, roles('admin'), async (req, res) => {
  try {
    const remb = await getRemb(req.params.id);
    if (!remb) return notFound(res, 'Demande introuvable');
    if (remb.statut !== 'En attente') return badRequest(res, 'Seule une demande en attente peut être approuvée');

    const tauxRemboursementPct = getTauxRemboursementPct();
    const montantOffert = Math.round(remb.montantRembourse * tauxRemboursementPct / 100);
    await db.execute(
      `UPDATE SD_Remboursement SET statut='Approuvé', montantOffert=?, idValidateur=?, dateTraitement=datetime('now') WHERE idRemboursement=?`,
      [montantOffert, req.user.idUser, req.params.id]
    );
    await notifierDemandeur(remb,
      '💬 Offre de remboursement disponible',
      `Nous vous proposons de vous rembourser ${montantOffert.toLocaleString('fr-FR')} sur les ${remb.montantRembourse.toLocaleString('fr-FR')} initialement payés (${tauxRemboursementPct}%). Rendez-vous sur votre espace pour accepter ou refuser cette offre.`
    );
    ok(res, { message: 'Offre de remboursement envoyée au demandeur', montantOffert });
  } catch (err) { serverError(res, err); }
});

// PUT /api/remboursements/:id/rejeter — admin uniquement : rejette la demande d'emblée
// (aucune offre n'est faite ; distinct d'un refus par le demandeur d'une offre déjà proposée).
router.put('/:id/rejeter', auth, roles('admin'), async (req, res) => {
  try {
    const remb = await getRemb(req.params.id);
    if (!remb) return notFound(res, 'Demande introuvable');
    if (remb.statut !== 'En attente') return badRequest(res, 'Seule une demande en attente peut être rejetée par l\'admin');

    const { motif } = req.body;
    await db.execute(
      `UPDATE SD_Remboursement SET statut='Rejeté', idValidateur=?, dateTraitement=datetime('now'), motif=COALESCE(?, motif) WHERE idRemboursement=?`,
      [req.user.idUser, motif || null, req.params.id]
    );
    await notifierDemandeur(remb, '❌ Demande de remboursement rejetée', motif || 'Votre demande de remboursement a été rejetée.');
    ok(res, { message: 'Demande rejetée' });
  } catch (err) { serverError(res, err); }
});

// PUT /api/remboursements/:id/accepter-offre — le demandeur (adhérent ou gestionnaire, sur sa
// propre demande) accepte l'offre partielle : le remboursement est exécuté immédiatement
// (paiement lié marqué "Remboursé", email envoyé via le circuit déjà existant). Si le paiement
// remboursé était la cotisation d'inscription d'une ORGANISATION (pas d'un adhérent individuel),
// c'est une rétractation complète : l'organisation est retirée de la plateforme (voir fermerOrganisation()).
router.put('/:id/accepter-offre', auth, roles('gestionnaire', 'adherent'), async (req, res) => {
  try {
    const remb = await getRemb(req.params.id);
    if (!remb) return notFound(res, 'Demande introuvable');
    if (!estLeDemandeur(req, remb)) return forbidden(res, 'Cette offre ne vous concerne pas');
    if (remb.statut !== 'Approuvé') return badRequest(res, 'Aucune offre en attente de votre décision pour cette demande');

    await db.execute(
      `UPDATE SD_Remboursement SET statut='Effectué', dateTraitement=datetime('now') WHERE idRemboursement=?`,
      [req.params.id]
    );
    await PaiementRepository.update(remb.idPaiement, { Statut: 'Remboursé' });

    try {
      const { envoyerEmailPaiement } = require('./paiements');
      const pay = await PaiementRepository.findByIdFull(remb.idPaiement);
      if (pay?.EmailAdh) await envoyerEmailPaiement(pay, 'Remboursé');
    } catch (e) { console.error('[Remboursement] email:', e.message); }

    let organisationFermee = false;
    if (!remb.idAdh && remb.numAgr) {
      await fermerOrganisation(remb.numAgr);
      organisationFermee = true;
    }

    ok(res, {
      message: organisationFermee
        ? 'Offre acceptée — remboursement effectué et organisation retirée de la plateforme'
        : 'Offre acceptée — remboursement effectué',
      montantOffert: remb.montantOffert,
      organisationFermee,
    });
  } catch (err) { serverError(res, err); }
});

// PUT /api/remboursements/:id/refuser-offre — le demandeur refuse l'offre partielle : aucun
// remboursement n'est effectué, le paiement initial reste inchangé ("l'argent reste").
router.put('/:id/refuser-offre', auth, roles('gestionnaire', 'adherent'), async (req, res) => {
  try {
    const remb = await getRemb(req.params.id);
    if (!remb) return notFound(res, 'Demande introuvable');
    if (!estLeDemandeur(req, remb)) return forbidden(res, 'Cette offre ne vous concerne pas');
    if (remb.statut !== 'Approuvé') return badRequest(res, 'Aucune offre en attente de votre décision pour cette demande');

    await db.execute(
      `UPDATE SD_Remboursement SET statut='Rejeté', dateTraitement=datetime('now'), motif='Offre de remboursement refusée par le demandeur.' WHERE idRemboursement=?`,
      [req.params.id]
    );
    ok(res, { message: 'Offre refusée — le paiement initial reste inchangé' });
  } catch (err) { serverError(res, err); }
});

function estLeDemandeur(req, remb) {
  if (req.user.role === 'gestionnaire') return remb.numAgr === req.user.NumAgr;
  if (req.user.role === 'adherent')     return remb.idAdh === req.user.idAdh;
  return false;
}

async function getRemb(id) {
  const [[row]] = await db.execute(`SELECT * FROM SD_Remboursement WHERE idRemboursement = ?`, [id]);
  return row || null;
}

async function notifierDemandeur(remb, titre, contenu) {
  let idUser = null;
  if (remb.idAdh) idUser = await NotificationService.idUserAdherent(remb.idAdh);
  else if (remb.numAgr) {
    const ids = await NotificationService.idsUsersOrganisation(remb.numAgr);
    idUser = ids[0] || null;
  }
  if (idUser) await NotificationService.notifier({ idUser, titre, contenu, type: 'remboursement', lien: '/remboursements' });
}

module.exports = router;
