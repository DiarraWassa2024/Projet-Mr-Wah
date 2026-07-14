const db = require('../config/database');

const STATUTS_SUPPRIMABLES = [3, 5]; // Suspendu, Clôturé — les seuls statuts autorisés pour une suppression définitive

/**
 * Purge complète d'un adhérent : compte de connexion, paiements, bénéficiaires (+ leurs
 * liaisons prestations), documents, remboursements/dettes, journal d'emails, notifications,
 * puis la fiche adhérent elle-même. Les demandes d'adhésion (SD_DemandeAdhesion) ne référencent
 * pas idAdh et sont volontairement conservées comme trace historique de la candidature.
 */
function purgerAdherentSync(raw, idAdh) {
  raw.prepare(`DELETE FROM SD_RemboursementDette WHERE idDette IN (SELECT idDette FROM SD_DetteAdherent WHERE idAdh = ?)`).run(idAdh);
  raw.prepare(`DELETE FROM SD_DetteAdherent WHERE idAdh = ?`).run(idAdh);
  raw.prepare(`DELETE FROM SD_Remboursement WHERE idAdh = ?`).run(idAdh);
  raw.prepare(`DELETE FROM GPOTB_PrestationBeneficiaire WHERE idBenef IN (SELECT idBenef FROM GPOTB06_Beneficiaire WHERE idAdh = ?)`).run(idAdh);
  raw.prepare(`DELETE FROM GPOTB06_Beneficiaire WHERE idAdh = ?`).run(idAdh);
  raw.prepare(`DELETE FROM GPOTB32_DocumentAdherent WHERE idAdh = ?`).run(idAdh);
  raw.prepare(`DELETE FROM SD_EmailLog WHERE idAdh = ?`).run(idAdh);

  const users = raw.prepare(`SELECT idUser FROM GPOTB_Users WHERE idAdh = ?`).all(idAdh);
  for (const u of users) {
    raw.prepare(`DELETE FROM SD_Notification WHERE idUser = ?`).run(u.idUser);
    raw.prepare(`DELETE FROM GPOTB_UserGroupe WHERE idUser = ?`).run(u.idUser);
  }
  raw.prepare(`DELETE FROM GPOTB_Users WHERE idAdh = ?`).run(idAdh);
  raw.prepare(`DELETE FROM GPOTB08_Paiement WHERE idAdh = ?`).run(idAdh);
  raw.prepare(`DELETE FROM GPOTB02_Adherent WHERE idAdh = ?`).run(idAdh);
}

/**
 * Purge complète d'une organisation : purge chacun de ses adhérents (voir ci-dessus), puis tous
 * les modules qui lui sont rattachés (prestations, événements, cotisations, documents, groupes,
 * autorisations, messages, campagnes de dons...), puis l'organisation elle-même. Les demandes
 * d'adhésion et les dons (historique financier des donateurs) sont conservés — seul le lien
 * `idCampagne` des dons est détaché avant suppression des campagnes.
 */
function purgerOrganisationSync(raw, numAgr) {
  const adherents = raw.prepare(`SELECT idAdh FROM GPOTB02_Adherent WHERE NumAgr = ?`).all(numAgr);
  for (const a of adherents) purgerAdherentSync(raw, a.idAdh);

  // Bénéficiaires rattachés directement à l'organisation (sans adhérent précis)
  raw.prepare(`DELETE FROM GPOTB_PrestationBeneficiaire WHERE idBenef IN (SELECT idBenef FROM GPOTB06_Beneficiaire WHERE NumAgr = ?)`).run(numAgr);
  raw.prepare(`DELETE FROM GPOTB06_Beneficiaire WHERE NumAgr = ?`).run(numAgr);

  // Prestations de l'organisation + liaisons bénéficiaires restantes
  raw.prepare(`DELETE FROM GPOTB_PrestationBeneficiaire WHERE IdPrest IN (SELECT IdPrest FROM GPOTB16_Prestation WHERE NumAgr = ?)`).run(numAgr);
  raw.prepare(`DELETE FROM GPOTB16_Prestation WHERE NumAgr = ?`).run(numAgr);

  // Remboursements / dettes / paiements restants au niveau organisation
  raw.prepare(`DELETE FROM SD_RemboursementDette WHERE idDette IN (SELECT idDette FROM SD_DetteAdherent WHERE numAgr = ?)`).run(numAgr);
  raw.prepare(`DELETE FROM SD_DetteAdherent WHERE numAgr = ?`).run(numAgr);
  raw.prepare(`DELETE FROM SD_Remboursement WHERE numAgr = ?`).run(numAgr);
  raw.prepare(`DELETE FROM GPOTB08_Paiement WHERE NumAgr = ?`).run(numAgr);

  // Campagnes de dons — les dons eux-mêmes (trace financière des donateurs) sont conservés,
  // seul leur lien vers la campagne supprimée est détaché
  raw.prepare(`UPDATE SD_Don SET idCampagne = NULL WHERE idCampagne IN (SELECT idCampagne FROM SD_CampagneDon WHERE numAgr = ?)`).run(numAgr);
  raw.prepare(`DELETE FROM SD_CampagneDon WHERE numAgr = ?`).run(numAgr);

  // Autres modules rattachés à l'organisation
  raw.prepare(`DELETE FROM GPOTB21_Evenement WHERE NumAgr = ?`).run(numAgr);
  raw.prepare(`DELETE FROM GPOTB24_Demande WHERE NumAgr = ?`).run(numAgr);
  raw.prepare(`DELETE FROM GPOTB25_Enregistrement WHERE NumAgr = ?`).run(numAgr);
  raw.prepare(`DELETE FROM SD_Opportunite WHERE numAgr = ?`).run(numAgr);
  raw.prepare(`DELETE FROM GPOTB29_AutorisationMinistere WHERE NumAgr = ?`).run(numAgr);
  raw.prepare(`DELETE FROM GPOTB30_Message WHERE NumAgrDest = ?`).run(numAgr);
  raw.prepare(`DELETE FROM SD_Actualite WHERE numAgr = ?`).run(numAgr);
  raw.prepare(`DELETE FROM GPOTB26_Document WHERE NumAgr = ?`).run(numAgr);
  raw.prepare(`DELETE FROM GPOTB14_Cotisation WHERE NumAgr = ?`).run(numAgr);

  // Groupes utilisateurs de l'organisation
  raw.prepare(`DELETE FROM GPOTB_UserGroupe WHERE IdGroupe IN (SELECT IdGroupe FROM GPOTB31_GroupeUtilisateur WHERE NumAgr = ?)`).run(numAgr);
  raw.prepare(`DELETE FROM GPOTB31_GroupeUtilisateur WHERE NumAgr = ?`).run(numAgr);

  // Comptes de connexion restants (gestionnaires) de l'organisation
  const users = raw.prepare(`SELECT idUser FROM GPOTB_Users WHERE NumAgr = ?`).all(numAgr);
  for (const u of users) {
    raw.prepare(`DELETE FROM SD_Notification WHERE idUser = ?`).run(u.idUser);
    raw.prepare(`DELETE FROM GPOTB_UserGroupe WHERE idUser = ?`).run(u.idUser);
  }
  raw.prepare(`DELETE FROM GPOTB_Users WHERE NumAgr = ?`).run(numAgr);

  raw.prepare(`DELETE FROM GPOTB01_Organisation WHERE NumAgr = ?`).run(numAgr);
}

module.exports = {
  STATUTS_SUPPRIMABLES,
  /** @returns {{idAdh:number,idsUsersSupprimes:number[]}} */
  purgerAdherent(idAdh) {
    const raw = db.raw;
    const usersAvant = raw.prepare(`SELECT idUser FROM GPOTB_Users WHERE idAdh = ?`).all(idAdh).map(u => u.idUser);
    raw.transaction(() => purgerAdherentSync(raw, idAdh))();
    return { idAdh, idsUsersSupprimes: usersAvant };
  },
  purgerOrganisation(numAgr) {
    const raw = db.raw;
    raw.transaction(() => purgerOrganisationSync(raw, numAgr))();
    return { numAgr };
  },
};
