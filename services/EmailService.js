const { sendMail } = require('./email');
const db = require('../config/database');

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

async function sendEmail({ to, subject, html, text, idAdh = null }) {
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];
  const result = await sendMail({ to, from: FROM, subject, html, text });
  const statut = result.ok ? 'envoyé' : 'erreur';
  const erreur = result.ok ? null : result.error;

  try {
    await db.execute(
      `INSERT INTO SD_EmailLog (destinataire, sujet, corps, dateEnvoi, statut, erreur, idAdh)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [to, subject, html || text || '', now, statut, erreur, idAdh]
    );
  } catch (_) {}

  return { statut };
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

module.exports = { sendEmail, tplConfirmation, tplBienvenue, tplRefus };
