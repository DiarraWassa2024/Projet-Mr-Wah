/**
 * Service de notification SMS / WhatsApp — utilisé pour envoyer le code de
 * confirmation d'adhésion (alternative à l'email, plus fiable dans certains contextes).
 *
 * Implémentation actuelle : SIMULÉE (aucun fournisseur SMS/WhatsApp configuré).
 * Le message est affiché en console, comme le mode mock de services/email.js.
 *
 * Pour brancher un vrai fournisseur plus tard (Twilio, WhatsApp Business API, etc.) :
 * remplacer uniquement le corps de la branche "sinon" ci-dessous par l'appel API réel,
 * en conservant la signature `sendNotification({ to, message, channel })`.
 */

function envoyerSimule({ to, message, channel }) {
  console.log('\n📱 ═══════════════════════════════════════');
  console.log(`CANAL   : ${channel.toUpperCase()}`);
  console.log(`TO      : ${to}`);
  console.log('─────────────────────────────────────────');
  console.log(message);
  console.log('═══════════════════════════════════════\n');
  return Promise.resolve({ ok: true, messageId: `mock-${channel}-${Date.now()}` });
}

/**
 * @param {{ to:string, message:string, channel?:'sms'|'whatsapp' }} opts
 */
async function sendNotification({ to, message, channel = 'sms' }) {
  if (!to) return { ok: false, error: 'Numéro de téléphone manquant' };

  // Point de bascule : si un fournisseur est configuré via variables d'environnement,
  // brancher ici l'appel réel (ex: Twilio, WhatsApp Business API). Sinon, simulation.
  const providerConfigured = !!process.env.SMS_PROVIDER;
  if (!providerConfigured) {
    return envoyerSimule({ to, message, channel });
  }

  // TODO: intégration réelle du fournisseur (process.env.SMS_PROVIDER, clés API, etc.)
  return envoyerSimule({ to, message, channel });
}

module.exports = { sendNotification };
