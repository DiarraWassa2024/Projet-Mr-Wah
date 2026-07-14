const db = require('../config/database');
const NotificationService = require('./NotificationService');
const EmailService = require('./EmailService');

/**
 * Retire une organisation de la plateforme : statut "Clôturé" (pas de suppression physique —
 * conserve l'historique/l'intégrité référentielle), compte gestionnaire désactivé, et chaque
 * adhérent déjà membre de cette organisation est prévenu par email de la fermeture.
 * Utilisé à la fois par la rétractation après remboursement (routes/remboursements.js) et par
 * le rejet pour document non authentique (services/DemandeService.js).
 */
async function fermerOrganisation(numAgr) {
  const [[org]] = await db.execute(`SELECT LibOrg FROM GPOTB01_Organisation WHERE NumAgr = ?`, [numAgr]);
  const orgName = org?.LibOrg || numAgr;

  await db.execute(`UPDATE GPOTB01_Organisation SET IdStatut = 5 WHERE NumAgr = ?`, [numAgr]);
  await db.execute(`UPDATE GPOTB_Users SET isActive = 0 WHERE NumAgr = ? AND role = 'gestionnaire'`, [numAgr]);

  const [membres] = await db.execute(
    `SELECT idAdh, NomAdh, PrenAdh, EmailAdh FROM GPOTB02_Adherent WHERE NumAgr = ?`, [numAgr]
  );
  for (const m of membres) {
    if (m.EmailAdh) {
      const { subject, html, text } = EmailService.tplOrganisationFermee(m, orgName);
      EmailService.sendEmail({ to: m.EmailAdh, subject, html, text, idAdh: m.idAdh }).catch(() => {});
    }
    const idUserMembre = await NotificationService.idUserAdherent(m.idAdh);
    if (idUserMembre) {
      await NotificationService.notifier({
        idUser: idUserMembre,
        titre: '⚠️ Organisation fermée',
        contenu: `"${orgName}" a été retirée de la plateforme SoliDev. Votre adhésion à cette organisation est terminée.`,
        type: 'systeme',
      });
    }
  }
}

/** Retire un adhérent individuel de la plateforme : statut "Clôturé", compte désactivé. */
async function fermerAdherent(idAdh) {
  await db.execute(`UPDATE GPOTB02_Adherent SET IdStatut = 5 WHERE idAdh = ?`, [idAdh]);
  await db.execute(`UPDATE GPOTB_Users SET isActive = 0 WHERE idAdh = ?`, [idAdh]);
}

module.exports = { fermerOrganisation, fermerAdherent };
