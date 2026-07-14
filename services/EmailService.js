const { sendMail } = require('./email');

const FROM = process.env.SMTP_FROM || '"SoliDev Platform" <noreply@solidev.africa>';

function wrapHtml(body) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f0;margin:0;padding:24px}
  .card{background:#fff;border-radius:16px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(14,53,50,.1)}
  .hdr{padding:32px 36px;color:#fff;text-align:center}
  .hdr img{width:44px;height:44px;border-radius:12px;margin-bottom:12px}
  .hdr h1{margin:0 0 6px;font-size:22px;font-weight:700}
  .hdr p{margin:0;opacity:.8;font-size:14px}
  .body{padding:32px 36px}
  .body p{margin:0 0 14px;color:#374151;line-height:1.6;font-size:14px}
  .id-box{background:#eff6ff;border:2px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin:18px 0;text-align:center}
  .id-box .id-num{font-family:monospace;font-size:24px;font-weight:700;color:#1e40af;letter-spacing:2px}
  .highlight{background:#f0fdf4;border-left:4px solid #4f7d5c;padding:14px 18px;border-radius:8px;margin:18px 0;color:#22302d;font-size:14px}
  .highlight.warn{background:#fdf3ea;border-color:#c1703f;color:#7a3d1e}
  .highlight.amber{background:#fdf6e8;border-color:#cf9a44;color:#7a5a1e}
  .ftr{background:#f7f4ee;padding:20px 36px;border-top:1px solid #e3dccb;text-align:center;color:#9c9a8f;font-size:12px}
  strong{color:#22302d}
</style>
</head><body><div class="card"><div style="background:linear-gradient(135deg,#145c56,#2f8f7f);text-align:center;padding-top:24px"><img src="${appUrl}/images/logo.svg" alt="SoliDev" style="width:44px;height:44px;border-radius:12px"></div>${body}</div></body></html>`;
}

// La journalisation dans SD_EmailLog est centralisée dans services/email.js::sendMail() —
// tout envoi passant par ici (ou directement par email.js) y est donc déjà tracé.
async function sendEmail({ to, subject, html, text, idAdh = null }) {
  const result = await sendMail({ to, from: FROM, subject, html, text, idAdh });
  return { statut: result.ok ? 'envoyé' : 'erreur' };
}

function tplConfirmation(adh, org) {
  const html = wrapHtml(`
    <div class="hdr" style="background:linear-gradient(135deg,#d97706,#f59e0b)">
      <h1>⏳ Demande reçue</h1>
      <p>SoliDev – Plateforme Panafricaine des Associations</p>
    </div>
    <div class="body">
      <p>Bonjour <strong>${adh.PrenAdh ? adh.PrenAdh + ' ' : ''}${adh.NomAdh}</strong>,</p>
      <p>Nous avons bien reçu votre demande d'adhésion à <strong>${org.LibOrg}</strong>.</p>
      <div class="highlight amber">
        Votre dossier est en cours d'examen. Vous serez informé(e) dès qu'une décision sera prise.<br>
        <strong>Délai habituel :</strong> 3 à 5 jours ouvrables.
      </div>
      <p>Votre identifiant de suivi : <strong style="font-family:monospace">${adh.NumAdherent}</strong></p>
    </div>
    <div class="ftr">SoliDev · Solidarité &amp; Développement · noreply@solidev.africa</div>
  `);
  return {
    subject: `Confirmation de réception — Demande d'adhésion ${org.LibOrg}`,
    html,
    text: `Bonjour ${adh.PrenAdh || ''} ${adh.NomAdh},\nDemande d'adhésion à ${org.LibOrg} reçue. Votre ID de suivi : ${adh.NumAdherent}`,
  };
}

function tplBienvenue(adh, org) {
  const html = wrapHtml(`
    <div class="hdr" style="background:linear-gradient(135deg,#059669,#10b981)">
      <h1>🎉 Bienvenue !</h1>
      <p>SoliDev – Plateforme Panafricaine des Associations</p>
    </div>
    <div class="body">
      <p>Bonjour <strong>${adh.PrenAdh ? adh.PrenAdh + ' ' : ''}${adh.NomAdh}</strong>,</p>
      <p>Votre adhésion à <strong>${org.LibOrg}</strong> a été <strong style="color:#059669">validée</strong>. Bienvenue parmi nous !</p>
      <div class="id-box">
        <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Votre identifiant membre</p>
        <div class="id-num">${adh.NumAdherent}</div>
      </div>
      <div class="highlight">
        Conservez cet identifiant — il vous sera demandé pour accéder aux services de la plateforme.
      </div>
    </div>
    <div class="ftr">SoliDev · Solidarité &amp; Développement · noreply@solidev.africa</div>
  `);
  return {
    subject: `🎉 Bienvenue dans ${org.LibOrg} — Adhésion confirmée`,
    html,
    text: `Bonjour ${adh.PrenAdh || ''} ${adh.NomAdh},\nVotre adhésion à ${org.LibOrg} est confirmée.\nVotre identifiant membre : ${adh.NumAdherent}`,
  };
}

function tplRefus(adh, org, motif) {
  const html = wrapHtml(`
    <div class="hdr" style="background:linear-gradient(135deg,#374151,#6b7280)">
      <h1>Décision sur votre demande</h1>
      <p>SoliDev – Plateforme Panafricaine des Associations</p>
    </div>
    <div class="body">
      <p>Bonjour <strong>${adh.PrenAdh ? adh.PrenAdh + ' ' : ''}${adh.NomAdh}</strong>,</p>
      <p>Nous avons examiné votre demande d'adhésion à <strong>${org.LibOrg}</strong> et nous regrettons de ne pas pouvoir y donner suite.</p>
      ${motif ? `<div class="highlight warn"><strong>Motif :</strong> ${motif}</div>` : ''}
      <p>Pour toute information complémentaire, veuillez contacter directement l'organisation.</p>
    </div>
    <div class="ftr">SoliDev · Solidarité &amp; Développement · noreply@solidev.africa</div>
  `);
  return {
    subject: `Décision sur votre demande d'adhésion — ${org.LibOrg}`,
    html,
    text: `Bonjour ${adh.PrenAdh || ''} ${adh.NomAdh},\nVotre demande d'adhésion à ${org.LibOrg} n'a pas été retenue.${motif ? '\nMotif : ' + motif : ''}`,
  };
}

/** Envoyé à chaque adhérent d'une organisation qui vient de fermer (rétractation + remboursement). */
function tplOrganisationFermee(adh, orgName) {
  const html = wrapHtml(`
    <div class="hdr" style="background:linear-gradient(135deg,#374151,#6b7280)">
      <h1>⚠️ Organisation fermée</h1>
      <p>SoliDev – Plateforme Panafricaine des Associations</p>
    </div>
    <div class="body">
      <p>Bonjour <strong>${adh.PrenAdh ? adh.PrenAdh + ' ' : ''}${adh.NomAdh || ''}</strong>,</p>
      <p>Nous vous informons que <strong>${orgName}</strong>, organisation à laquelle vous êtes affilié(e), a été
         <strong style="color:#374151">retirée de la plateforme SoliDev</strong> à la demande de ses responsables.</p>
      <div class="highlight warn">
        Votre adhésion à cette organisation est désormais terminée. Si vous souhaitez rejoindre une autre
        organisation sur SoliDev, vous pouvez soumettre une nouvelle demande d'adhésion à tout moment.
      </div>
    </div>
    <div class="ftr">SoliDev · Solidarité &amp; Développement · noreply@solidev.africa</div>
  `);
  return {
    subject: `⚠️ ${orgName} a été retirée de SoliDev`,
    html,
    text: `Bonjour ${adh.PrenAdh || ''} ${adh.NomAdh || ''},\n\n"${orgName}", organisation à laquelle vous étiez affilié(e), a été retirée de la plateforme SoliDev à la demande de ses responsables. Votre adhésion à cette organisation est désormais terminée.`,
  };
}

const MODE_PAIEMENT_LABELS = {
  wave: 'Wave', orange_money: 'Orange Money', orange_money_mg: 'Orange Money',
  mtn_money: 'MTN Mobile Money', moov_money: 'Moov Money', opay: 'OPay', palmpay: 'PalmPay',
  mvola: 'MVola', airtel_money: 'Airtel Money', virement: 'Virement bancaire',
  especes: 'Espèces', mobile_money: 'Mobile Money',
};

/** Reçu envoyé au donateur après un don (montant, organisation bénéficiaire, répartition). */
function tplRecuDon(don) {
  const fmt = n => Number(n || 0).toLocaleString('fr-FR');
  const devise = don.codeDevise || 'XOF';
  const dateStr = new Date(don.dateDon || Date.now()).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
  const modeLabel = MODE_PAIEMENT_LABELS[don.modePaiement] || don.modePaiement || 'Mobile Money';

  const repartitionBlock = don.orgLibOrg ? `
      <div class="highlight">
        <strong>${fmt(don.montantOrg)} ${devise}</strong> seront versés à <strong>${don.orgLibOrg}</strong><br>
        <strong>${fmt(don.montantPlateforme)} ${devise}</strong> (${don.tauxCommission}%) — commission plateforme SoliDev
      </div>` : `
      <div class="highlight">
        L'intégralité de ce don (<strong>${fmt(don.montantPlateforme)} ${devise}</strong>) soutient directement la plateforme SoliDev.
      </div>`;

  const html = wrapHtml(`
    <div class="hdr" style="background:linear-gradient(135deg,#e91e8c,#f59e0b)">
      <h1>💝 Merci pour votre don !</h1>
      <p>SoliDev – Plateforme Panafricaine des Associations</p>
    </div>
    <div class="body">
      <p>Bonjour${don.nom ? ' <strong>' + don.nom + '</strong>' : ''},</p>
      <p>Nous avons bien reçu votre don. Voici votre reçu récapitulatif.</p>
      <div class="id-box">
        <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Référence du don</p>
        <div class="id-num">#${don.idDon}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px;color:#374151">
        <tr><td style="padding:6px 0;color:#6b7280">Montant du don</td><td style="padding:6px 0;text-align:right"><strong>${fmt(don.montant)} ${devise}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Destination</td><td style="padding:6px 0;text-align:right"><strong>${don.orgLibOrg || 'Don général — SoliDev'}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Mode de paiement</td><td style="padding:6px 0;text-align:right">${modeLabel}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Date</td><td style="padding:6px 0;text-align:right">${dateStr}</td></tr>
      </table>
      ${repartitionBlock}
      ${don.message ? `<p style="font-style:italic;color:#6b7280">« ${don.message} »</p>` : ''}
      <div class="highlight warn">
        ⏳ Notre équipe vous contactera sous 24h pour finaliser les modalités de versement.
      </div>
      <p style="margin-top:20px">Merci pour votre générosité,<br><strong>L'équipe SoliDev</strong></p>
    </div>
    <div class="ftr">SoliDev · Solidarité &amp; Développement · noreply@solidev.africa</div>
  `);

  const text = `Merci pour votre don #${don.idDon} !\n\n`
    + `Montant : ${fmt(don.montant)} ${devise}\n`
    + `Destination : ${don.orgLibOrg || 'Don général — SoliDev'}\n`
    + `Mode de paiement : ${modeLabel}\n`
    + `Date : ${dateStr}\n\n`
    + (don.orgLibOrg
        ? `${fmt(don.montantOrg)} ${devise} seront versés à ${don.orgLibOrg}.\n${fmt(don.montantPlateforme)} ${devise} (${don.tauxCommission}%) — commission plateforme SoliDev.\n\n`
        : `L'intégralité (${fmt(don.montantPlateforme)} ${devise}) soutient directement la plateforme SoliDev.\n\n`)
    + `Notre équipe vous contactera sous 24h pour finaliser les modalités de versement.`;

  return {
    subject: `💝 Reçu de votre don #${don.idDon} — SoliDev`,
    html,
    text,
  };
}

module.exports = { sendEmail, tplConfirmation, tplBienvenue, tplRefus, tplRecuDon, tplOrganisationFermee };
