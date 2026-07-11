/**
 * Configuration déclarative pays → devise → opérateurs de paiement mobile.
 * Source de vérité serveur (miroir de public/js/pays-config.js pour la devise).
 *
 * Ajouter un pays/opérateur = ajouter une entrée ici, aucune autre modification requise.
 */
module.exports = {
  CIV: {
    devise: 'XOF',
    operateurs: [
      { code: 'wave',         label: 'Wave',            icon: '🌊' },
      { code: 'orange_money', label: 'Orange Money',    icon: '🟠' },
      { code: 'mtn_money',    label: 'MTN Mobile Money', icon: '🟡' },
      { code: 'moov_money',   label: 'Moov Money',      icon: '🔵' },
    ],
  },
  MLI: {
    devise: 'XOF',
    operateurs: [
      { code: 'orange_money', label: 'Orange Money',    icon: '🟠' },
      { code: 'moov_money',   label: 'Moov Money',      icon: '🔵' },
    ],
  },
  BEN: {
    devise: 'XOF',
    operateurs: [
      { code: 'mtn_money',    label: 'MTN Mobile Money', icon: '🟡' },
      { code: 'moov_money',   label: 'Moov Money',      icon: '🔵' },
    ],
  },
  BFA: {
    devise: 'XOF',
    operateurs: [
      { code: 'orange_money', label: 'Orange Money',    icon: '🟠' },
      { code: 'moov_money',   label: 'Moov Money',      icon: '🔵' },
    ],
  },
  NGA: {
    devise: 'NGN',
    operateurs: [
      { code: 'opay',    label: 'OPay',    icon: '🟢' },
      { code: 'palmpay', label: 'PalmPay', icon: '🟣' },
    ],
  },
  MDG: {
    devise: 'MGA',
    operateurs: [
      { code: 'mvola',           label: 'MVola',                    icon: '🟠' },
      { code: 'orange_money_mg', label: 'Orange Money Madagascar',  icon: '🟠' },
      { code: 'airtel_money',    label: 'Airtel Money',            icon: '🔴' },
    ],
  },
};
