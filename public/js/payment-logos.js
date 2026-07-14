/**
 * Badges visuels (SVG dessinés en interne, pas de fichier téléchargé) pour les opérateurs
 * de paiement mobile money — couleur de marque + initiales, en complément/remplacement de
 * l'icône emoji fournie par config/paymentProviders.js (fallback si un code est inconnu).
 * Chargé globalement, disponible via window.PAYMENT_LOGOS / paymentLogo(code).
 */
function badgeSvg(bg, fg, text) {
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <circle cx="20" cy="20" r="20" fill="${bg}"/>
    <text x="20" y="25" font-family="Arial,Helvetica,sans-serif" font-size="${text.length > 2 ? 11 : 15}"
          font-weight="800" fill="${fg}" text-anchor="middle">${text}</text>
  </svg>`;
}

const PAYMENT_LOGOS = {
  wave:            badgeSvg('#1DA1F2', '#fff', 'W'),
  orange_money:    badgeSvg('#FF6600', '#fff', 'OM'),
  orange_money_mg: badgeSvg('#FF6600', '#fff', 'OM'),
  mtn_money:       badgeSvg('#FFCC00', '#111', 'MTN'),
  moov_money:      badgeSvg('#0057B8', '#fff', 'Moov'),
  opay:            badgeSvg('#0EA347', '#fff', 'OPay'),
  palmpay:         badgeSvg('#6C2BD9', '#fff', 'PP'),
  mvola:           badgeSvg('#F7941E', '#fff', 'MV'),
  airtel_money:    badgeSvg('#ED1C24', '#fff', 'A'),
  virement:        badgeSvg('#334155', '#fff', '🏦'),
  especes:         badgeSvg('#059669', '#fff', '💵'),
};

function paymentLogo(code) {
  return PAYMENT_LOGOS[code] || null;
}
