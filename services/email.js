const nodemailer = require('nodemailer');
const db = require('../config/database');

/* ── Transporteurs ─────────────────────────────────────────────────
   Resend (service transactionnel, bien plus fiable qu'un relais SMTP personnel —
   notamment vers iCloud/Outlook, qui filtrent sévèrement Gmail relayé) est tenté en
   premier s'il est configuré ; en cas d'échec (ex. domaine pas encore vérifié chez
   Resend, qui restreint alors l'envoi au seul propriétaire du compte), on retombe
   automatiquement sur SMTP (Gmail...) pour ne jamais régresser par rapport à l'existant. */
const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function sendViaResend(opts) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: opts.from || process.env.RESEND_FROM || 'SoliDev <onboarding@resend.dev>',
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Resend a répondu ${res.status}`);
  return { messageId: data.id, response: `Resend OK (id: ${data.id})` };
}

const fallbackTransporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      pool:   true,
    })
  : {
      sendMail: (opts) => {
        console.log('\n📧 ═══════════════════════════════════════');
        console.log(`TO      : ${opts.to}`);
        console.log(`SUBJECT : ${opts.subject}`);
        console.log('─────────────────────────────────────────');
        console.log(opts.text || '[HTML email]');
        console.log('═══════════════════════════════════════\n');
        return Promise.resolve({ messageId: `mock-${Date.now()}` });
      },
    };

const FROM = process.env.SMTP_FROM || '"SoliDev Platform" <noreply@solidev.africa>';

/* ── Templates ───────────────────────────────────────── */
function wrapHtml(body) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f0;margin:0;padding:24px}
  .card{background:#fff;border-radius:16px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(14,53,50,.1)}
  .hdr{background:linear-gradient(135deg,#145c56,#2f8f7f);padding:28px 36px 30px;color:#fff;text-align:center}
  .hdr img{width:44px;height:44px;border-radius:12px;margin-bottom:12px}
  .hdr h1{margin:0 0 6px;font-size:22px;font-weight:700}
  .hdr p{margin:0;opacity:.8;font-size:14px}
  .body{padding:32px 36px}
  .body p{margin:0 0 14px;color:#374151;line-height:1.6;font-size:14px}
  .highlight{background:#f0fdf4;border-left:4px solid #4f7d5c;padding:14px 18px;border-radius:8px;margin:18px 0;color:#22302d;font-size:14px}
  .highlight.warn{background:#fdf3ea;border-color:#c1703f;color:#7a3d1e}
  .btn{display:inline-block;background:linear-gradient(135deg,#145c56,#2f8f7f);color:#fff;
       padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;margin:10px 0}
  .ftr{background:#f7f4ee;padding:20px 36px;border-top:1px solid #e3dccb;text-align:center;
       color:#9c9a8f;font-size:12px}
  strong{color:#22302d}
</style>
</head><body><div class="card"><div class="hdr-logo-wrap" style="background:linear-gradient(135deg,#145c56,#2f8f7f);text-align:center;padding-top:24px"><img src="${appUrl}/images/logo.svg" alt="SoliDev" style="width:44px;height:44px;border-radius:12px"></div>${body}</div></body></html>`;
}

/**
 * Email envoyé immédiatement après acceptation : annonce + identifiants de connexion.
 * Le paiement de la cotisation se fait après connexion, depuis l'espace personnel.
 */
function emailAccepteeAvecIdentifiants(demande, { username, password, montantAnnuel, codeDevise, dejaPayee = false }) {
  const loginUrl = process.env.APP_URL || 'http://localhost:3000';
  const fmt = n => Number(n || 0).toLocaleString('fr-FR');
  const aDesIdentifiants = !!(username && password);

  const credBlock = aDesIdentifiants ? `
      <p>Voici vos identifiants de connexion, valables dès maintenant et à tout moment par la suite :</p>
      <div class="highlight">
        Identifiant : <strong style="font-family:monospace">${username}</strong><br>
        Mot de passe : <strong style="font-family:monospace">${password}</strong>
      </div>
      <p style="color:#7c2d12;background:#fff7ed;border-radius:8px;padding:10px 14px;font-size:13px">
        ⚠️ Ce mot de passe ne sera communiqué qu'une seule fois. Conservez-le en lieu sûr et changez-le dès votre première connexion.
      </p>` : `
      <div class="highlight">
        Aucune adresse email n'était disponible pour créer votre accès — contactez l'administrateur.
      </div>`;

  const html = wrapHtml(`
    <div class="hdr">
      <h1>🎉 Demande acceptée</h1>
      <p>SoliDev – Plateforme Panafricaine des Associations</p>
    </div>
    <div class="body">
      <p>Bonjour <strong>${demande.repPrenom || ''} ${demande.repNom || demande.nomOrg}</strong>,</p>
      <p>Nous avons le plaisir de vous informer que votre demande d'adhésion pour
         <strong>${demande.nomOrg}</strong> a été <strong style="color:#059669">acceptée</strong> !</p>
      ${credBlock}
      ${dejaPayee ? `
      <div class="highlight">
        ✅ Votre cotisation annuelle (${fmt(montantAnnuel)} ${codeDevise}) a déjà été réglée à l'inscription.
        Votre compte est <strong>immédiatement actif</strong>, vous pouvez vous connecter dès maintenant.
      </div>` : `
      <div class="highlight warn">
        ⏳ Une fois connecté(e), il vous sera demandé de régler votre cotisation annuelle
        (<strong>${fmt(montantAnnuel)} ${codeDevise}</strong>) pour accéder pleinement à votre espace.
      </div>`}
      <p style="text-align:center">
        <a href="${loginUrl}" class="btn">Se connecter à SoliDev →</a>
      </p>
    </div>
    <div class="ftr">SoliDev · Solidarité &amp; Développement · noreply@solidev.africa</div>
  `);

  const text = `Bonjour ${demande.repPrenom || ''} ${demande.repNom || demande.nomOrg},\n\n`
    + `Votre demande d'adhésion pour "${demande.nomOrg}" a été ACCEPTÉE.\n\n`
    + (aDesIdentifiants
        ? `Identifiant : ${username}\nMot de passe : ${password}\n\n`
        : `Aucune adresse email n'était disponible pour créer votre accès — contactez l'administrateur.\n\n`)
    + (dejaPayee
        ? `Votre cotisation annuelle (${fmt(montantAnnuel)} ${codeDevise}) a déjà été réglée à l'inscription — votre compte est immédiatement actif.\n\n`
        : `Une fois connecté(e), réglez votre cotisation annuelle (${fmt(montantAnnuel)} ${codeDevise}) pour activer pleinement votre compte.\n\n`)
    + `Connexion : ${loginUrl}`;

  return {
    to: demande.emailOrg,
    from: FROM,
    subject: `🎉 Bienvenue sur SoliDev — vos identifiants | ${demande.nomOrg}`,
    html,
    text,
  };
}

function emailRefusee(demande, motif) {
  const html = wrapHtml(`
    <div class="hdr" style="background:linear-gradient(135deg,#991b1b,#dc2626)">
      <h1>❌ Demande non approuvée</h1>
      <p>SoliDev – Plateforme Panafricaine des Associations</p>
    </div>
    <div class="body">
      <p>Bonjour <strong>${demande.repPrenom || ''} ${demande.repNom || demande.nomOrg}</strong>,</p>
      <p>Nous avons examiné votre demande d'adhésion pour l'organisation
         <strong>${demande.nomOrg}</strong> et nous regrettons de ne pas pouvoir y donner suite.</p>
      ${motif ? `<div class="highlight warn">
        <strong>Motif communiqué par l'administrateur :</strong><br>${motif}
      </div>` : ''}
      <p>Si vous pensez qu'il s'agit d'une erreur ou si vous souhaitez soumettre une nouvelle demande
         avec des informations complémentaires, vous pouvez nous contacter.</p>
      <p style="margin-top:20px">Cordialement,<br><strong>L'équipe SoliDev</strong></p>
    </div>
    <div class="ftr">SoliDev · Solidarité &amp; Développement · noreply@solidev.africa</div>
  `);

  const text = `Bonjour ${demande.repPrenom || ''} ${demande.repNom || demande.nomOrg},\n\n`
    + `Votre demande d'adhésion pour "${demande.nomOrg}" n'a pas été approuvée.\n`
    + (motif ? `Motif : ${motif}\n` : '');

  return {
    to: demande.emailOrg,
    from: FROM,
    subject: `❌ Demande non approuvée – ${demande.nomOrg} | SoliDev`,
    html,
    text,
  };
}

function emailReinitialisationMDP(user, lien) {
  const html = wrapHtml(`
    <div class="hdr">
      <h1>🔑 Réinitialisation de mot de passe</h1>
      <p>SoliDev – Plateforme Panafricaine des Associations</p>
    </div>
    <div class="body">
      <p>Bonjour <strong>${user.username}</strong>,</p>
      <p>Une demande de réinitialisation de mot de passe a été effectuée pour votre compte. Cliquez
         sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
      <p style="text-align:center">
        <a href="${lien}" class="btn">Réinitialiser mon mot de passe →</a>
      </p>
      <p style="color:#7c2d12;background:#fff7ed;border-radius:8px;padding:10px 14px;font-size:13px">
        ⚠️ Ce lien expire dans 1 heure et ne peut être utilisé qu'une seule fois. Si vous n'êtes pas
        à l'origine de cette demande, ignorez simplement cet email — votre mot de passe actuel reste valable.
      </p>
    </div>
    <div class="ftr">SoliDev · Solidarité &amp; Développement · noreply@solidev.africa</div>
  `);

  const text = `Bonjour ${user.username},\n\n`
    + `Une demande de réinitialisation de mot de passe a été effectuée pour votre compte.\n`
    + `Cliquez sur ce lien pour choisir un nouveau mot de passe (valable 1 heure, usage unique) :\n${lien}\n\n`
    + `Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;

  return {
    to: user.email,
    from: FROM,
    subject: '🔑 Réinitialisation de votre mot de passe SoliDev',
    html,
    text,
  };
}

function emailNouvelleDemande(demande) {
  const text = `Nouvelle demande d'adhésion reçue.\n\n`
    + `Organisation : ${demande.nomOrg}\nType : ${demande.typeOrg}\nEmail : ${demande.emailOrg}\n`
    + `Responsable : ${demande.repPrenom || ''} ${demande.repNom || ''}\n`
    + `Date : ${new Date().toLocaleString('fr-FR')}`;
  return {
    to: process.env.ADMIN_EMAIL || 'admin@gpo.org',
    from: FROM,
    subject: `🔔 Nouvelle demande d'adhésion – ${demande.nomOrg}`,
    text,
  };
}

/* ── sendMail helper ─────────────────────────────────── */
// Journalise chaque envoi dans SD_EmailLog (destinataire, statut, réponse SMTP brute, erreur) —
// un envoi "réussi" ne veut dire que le serveur SMTP a accepté le message pour relais : ça ne
// garantit pas la livraison réelle dans la boîte du destinataire (spam, rejet silencieux plus
// loin dans la chaîne restent invisibles depuis ce point).
async function sendMail(opts) {
  const { idAdh, ...mailOpts } = opts;
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];
  try {
    let info;
    if (RESEND_API_KEY) {
      try {
        info = await sendViaResend(mailOpts);
      } catch (resendErr) {
        console.error('Resend a échoué, repli sur SMTP/console:', resendErr.message);
        info = await fallbackTransporter.sendMail(mailOpts);
        info.response = `[Repli après échec Resend: ${resendErr.message}] ${info.response || ''}`.trim();
      }
    } else {
      info = await fallbackTransporter.sendMail(mailOpts);
    }
    const reponseSMTP = info.response || null;
    await logEmail(mailOpts, 'envoyé', null, reponseSMTP, now, idAdh);
    return { ok: true, messageId: info.messageId, response: reponseSMTP };
  } catch (err) {
    console.error('Email error:', err.message);
    await logEmail(mailOpts, 'échec', err.message, null, now, idAdh);
    return { ok: false, error: err.message };
  }
}

async function logEmail(mailOpts, statut, erreur, reponseSMTP, dateEnvoi, idAdh) {
  try {
    await db.execute(
      `INSERT INTO SD_EmailLog (destinataire, sujet, corps, dateEnvoi, statut, erreur, reponseSMTP, idAdh)
       VALUES (?,?,?,?,?,?,?,?)`,
      [mailOpts.to, mailOpts.subject, mailOpts.html || mailOpts.text || null, dateEnvoi, statut, erreur, reponseSMTP, idAdh || null]
    );
  } catch (e) { console.error('Log email échoué:', e.message); }
}

module.exports = { sendMail, emailAccepteeAvecIdentifiants, emailRefusee, emailNouvelleDemande, emailReinitialisationMDP };
