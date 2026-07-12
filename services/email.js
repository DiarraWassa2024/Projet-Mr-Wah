const nodemailer = require('nodemailer');

/* ── Transporter (singleton) ─────────────────────────── */
const transporter = process.env.SMTP_HOST
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
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;margin:0;padding:24px}
  .card{background:#fff;border-radius:16px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.09)}
  .hdr{background:linear-gradient(135deg,#1e40af,#4f46e5);padding:32px 36px;color:#fff;text-align:center}
  .hdr h1{margin:0 0 6px;font-size:22px;font-weight:700}
  .hdr p{margin:0;opacity:.8;font-size:14px}
  .body{padding:32px 36px}
  .body p{margin:0 0 14px;color:#374151;line-height:1.6;font-size:14px}
  .highlight{background:#f0fdf4;border-left:4px solid #10b981;padding:14px 18px;border-radius:8px;margin:18px 0;color:#064e3b;font-size:14px}
  .highlight.warn{background:#fff7ed;border-color:#f97316;color:#7c2d12}
  .btn{display:inline-block;background:linear-gradient(135deg,#1e40af,#4f46e5);color:#fff;
       padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;margin:10px 0}
  .ftr{background:#f8fafc;padding:20px 36px;border-top:1px solid #e5e7eb;text-align:center;
       color:#9ca3af;font-size:12px}
  strong{color:#1e293b}
</style>
</head><body><div class="card">${body}</div></body></html>`;
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
      <p>Voici vos identifiants de connexion :</p>
      <div class="highlight">
        Identifiant : <strong style="font-family:monospace">${username}</strong><br>
        Mot de passe : <strong style="font-family:monospace">${password}</strong>
      </div>
      <p style="color:#7c2d12;background:#fff7ed;border-radius:8px;padding:10px 14px;font-size:13px">
        ⚠️ Ce mot de passe ne sera communiqué qu'une seule fois. Conservez-le en lieu sûr et changez-le dès votre première connexion.
      </p>` : `
      <div class="highlight">
        Un compte SoliDev existe déjà pour cet email — connectez-vous avec vos identifiants habituels.
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
        : `Un compte existe déjà pour cet email — connectez-vous avec vos identifiants habituels.\n\n`)
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
async function sendMail(opts) {
  try {
    const info = await transporter.sendMail(opts);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('Email error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { sendMail, emailAccepteeAvecIdentifiants, emailRefusee, emailNouvelleDemande };
