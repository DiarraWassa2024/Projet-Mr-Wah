const PROVIDERS          = require('../../config/paymentProviders');
const PaymentProvider     = require('./PaymentProvider');
const PaiementRepository  = require('../../repositories/PaiementRepository');

const PaymentService = {
  /** Liste des opérateurs disponibles pour un pays donné (ou null si pays non couvert). */
  getOperateurs(codePays) {
    const cfg = PROVIDERS[codePays];
    if (!cfg) return null;
    return { codePays, devise: cfg.devise, operateurs: cfg.operateurs };
  },

  /**
   * Exécute le paiement d'une ligne GPOTB08_Paiement existante via l'opérateur choisi.
   * Ne déclenche PAS la suite du workflow d'adhésion (génération d'identifiants) —
   * c'est à l'appelant (route) de le faire s'il constate que `idDemande` est renseigné,
   * pour ne pas coupler ce service de paiement à la logique métier des adhésions.
   */
  async payer(idPaiement, { operateur, telephone } = {}) {
    const pay = await PaiementRepository.findByIdFull(idPaiement);
    if (!pay) throw Object.assign(new Error('Paiement introuvable'), { status: 404 });
    if (pay.Statut === 'Payé')
      throw Object.assign(new Error('Ce paiement a déjà été réglé'), { status: 400 });

    const codePays = pay.CodePays;
    const cfg = PROVIDERS[codePays];
    if (!cfg) throw Object.assign(new Error(`Aucun opérateur de paiement disponible pour le pays ${codePays || '—'}`), { status: 400 });

    const operateurCode = operateur || cfg.operateurs[0].code;
    if (!cfg.operateurs.some(o => o.code === operateurCode))
      throw Object.assign(new Error('Opérateur non pris en charge pour ce pays'), { status: 400 });

    const provider = new PaymentProvider(operateurCode, cfg.devise);
    const result = await provider.charge({
      montant: pay.MontantPaiement,
      telephone: telephone || pay.TelAdh || '',
      reference: pay.NumRecu || pay.Reference || `PAY-${pay.IdPaiement}`,
    });

    if (result.success) {
      await PaiementRepository.update(idPaiement, {
        Statut: 'Payé',
        Operateur: operateurCode,
        Reference: result.transactionRef,
        CodeDevise: pay.CodeDevise || cfg.devise,
      });
    }

    return { ...result, idPaiement: Number(idPaiement), idDemande: pay.idDemande || null };
  },
};

module.exports = PaymentService;
