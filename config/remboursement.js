// Pourcentage du paiement effectivement proposé lors d'un remboursement (rétractation après
// paiement déjà effectué). Le solde reste acquis à la plateforme/organisation — le demandeur
// doit explicitement accepter cette offre partielle pour que le remboursement soit exécuté.
//
// Modifiable depuis l'admin sans redéploiement (SD_ConfigPlateforme, clé TAUX_REMBOURSEMENT_PCT) —
// la valeur d'environnement ne sert que de repli tant qu'aucune ligne n'existe encore en base.
const DEFAULT_PCT = Number(process.env.TAUX_REMBOURSEMENT_PCT) || 80;

function getTauxRemboursementPct() {
  try {
    const db = require('./database').raw;
    const row = db.prepare(`SELECT valeur FROM SD_ConfigPlateforme WHERE cle = 'TAUX_REMBOURSEMENT_PCT'`).get();
    return row ? Number(row.valeur) : DEFAULT_PCT;
  } catch (_) {
    return DEFAULT_PCT;
  }
}

module.exports = { getTauxRemboursementPct, DEFAULT_PCT };
