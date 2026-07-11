/**
 * PaymentProvider — passerelle de paiement mobile money.
 *
 * Implémentation actuelle : SIMULÉE (aucun identifiant marchand réel disponible).
 * Le paiement est considéré confirmé après un court délai, comme si l'opérateur
 * avait répondu. Pour brancher une vraie API un jour, il suffit de remplacer
 * le corps de `charge()` par l'appel HTTP réel de l'opérateur — la signature
 * (entrées/sorties) et tous les appelants (PaymentService) restent inchangés.
 */
class PaymentProvider {
  constructor(operateurCode, devise) {
    this.operateurCode = operateurCode;
    this.devise = devise;
  }

  /**
   * @param {{ montant:number, telephone:string, reference:string }} payload
   * @returns {Promise<{ success:boolean, transactionRef:string }>}
   */
  async charge({ montant, telephone, reference }) {
    // Latence simulée d'un aller-retour opérateur
    await new Promise(resolve => setTimeout(resolve, 400));

    return {
      success: true,
      transactionRef: `SIM-${this.operateurCode.toUpperCase()}-${Date.now()}`,
    };
  }
}

module.exports = PaymentProvider;
