// Pourcentage du paiement effectivement proposé lors d'un remboursement (rétractation après
// paiement déjà effectué). Le solde reste acquis à la plateforme/organisation — le demandeur
// doit explicitement accepter cette offre partielle pour que le remboursement soit exécuté.
module.exports = {
  TAUX_REMBOURSEMENT_PCT: Number(process.env.TAUX_REMBOURSEMENT_PCT) || 80,
};
