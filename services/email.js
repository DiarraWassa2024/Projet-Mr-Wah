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

function emailAcceptee(demande) {
  const html = wrapHtml(`
    <div class="hdr">
      <h1>🎉 Demande acceptée</h1>
      <p>SoliDev – Plateforme Panafricaine des Associations</p>
    </div>
    <div class="body">
      <p>Bonjour <strong>${demande.repPrenom || ''} ${demande.repNom || demande.nomOrg}</strong>,</p>
      <p>Nous avons le plaisir de vous informer que votre demande d'adhésion pour l'organisation
         <strong>${demande.nomOrg}</strong> a été <strong style="color:#059669">acceptée</strong>.</p>
      <div class="highlight">
        ✅ Votre organisation est désormais enregistrée sur SoliDev.<br>
        Vous pouvez vous connecter à votre espace de gestion.
      </div>
      <p>Voici un récapitulatif de votre dossier :</p>
      <ul style="color:#374151;font-size:14px;line-height:2">
        <li>Organisation : <strong>${demande.nomOrg}</strong></li>
        <li>Type : <strong>${demande.typeOrg}</strong></li>
        <li>Pays : <strong>${demande.libPays || demande.codePays || '—'}</strong></li>
        <li>Date de traitement : <strong>${new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}</strong></li>
      </ul>
      <a href="${process.env.APP_URL || 'http://localhost:3000'}" class="btn">Se connecter à SoliDev →</a>
    </div>
    <div class="ftr">SoliDev · Solidarité &amp; Développement · noreply@solidev.africa</div>
  `);

  const text = `Bonjour ${demande.repPrenom || ''} ${demande.repNom || demande.nomOrg},\n\n`
    + `Votre demande d'adhésion pour l'organisation "${demande.nomOrg}" a été ACCEPTÉE.\n`
    + `Votre organisation est désormais enregistrée sur SoliDev.\n\nConnectez-vous sur : http://localhost:3000`;

  return {
    to: demande.emailOrg,
    from: FROM,
    subject: `✅ Demande acceptée – ${demande.nomOrg} | SoliDev`,
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

function emailAccepteeDoitPayer(demande, { idPaiement, Mensuelle, Annuelle, CodeDevise }) {
  const paymentUrl = `${process.env.APP_URL || 'http://localhost:3000'}/?paiement=${idPaiement}`;
  const fmt = n => Number(n || 0).toLocaleString('fr-FR');

  const html = wrapHtml(`
    <div class="hdr">
      <h1>🎉 Demande acceptée</h1>
      <p>SoliDev – Plateforme Panafricaine des Associations</p>
    </div>
    <div class="body">
      <p>Bonjour <strong>${demande.repPrenom || ''} ${demande.repNom || demande.nomOrg}</strong>,</p>
      <p>Nous avons le plaisir de vous informer que votre demande d'adhésion pour
         <strong>${demande.nomOrg}</strong> a été <strong style="color:#059669">acceptée</strong>.</p>
      <div class="highlight warn">
        ⏳ Il ne reste qu'une étape : le règlement de votre cotisation pour activer définitivement votre accès.
      </div>
      <p>Choisissez la formule qui vous convient :</p>
      <ul style="color:#374151;font-size:14px;line-height:2">
        <li>Abonnement <strong>Mensuel</strong> : <strong>${fmt(Mensuelle)} ${CodeDevise}</strong></li>
        <li>Abonnement <strong>Annuel</strong> : <strong>${fmt(Annuelle)} ${CodeDevise}</strong> (formule proposée par défaut)</li>
      </ul>
      <p style="text-align:center">
        <a href="${paymentUrl}" class="btn">Procéder au paiement →</a>
      </p>
      <p style="color:#6b7280;font-size:13px">
        Dès la confirmation de votre paiement, vous recevrez automatiquement vos identifiants de connexion.
      </p>
    </div>
    <div class="ftr">SoliDev · Solidarité &amp; Développement · noreply@solidev.africa</div>
  `);

  const text = `Bonjour ${demande.repPrenom || ''} ${demande.repNom || demande.nomOrg},\n\n`
    + `Votre demande d'adhésion pour "${demande.nomOrg}" a été ACCEPTÉE.\n`
    + `Il vous reste à régler votre cotisation :\n`
    + `- Mensuel : ${fmt(Mensuelle)} ${CodeDevise}\n- Annuel : ${fmt(Annuelle)} ${CodeDevise}\n\n`
    + `Payer ici : ${paymentUrl}`;

  return {
    to: demande.emailOrg,
    from: FROM,
    subject: `✅ Demande acceptée — Cotisation à régler | ${demande.nomOrg}`,
    html,
    text,
  };
}

function emailIdentifiants({ nom, email, username, password }) {
  const loginUrl = process.env.APP_URL || 'http://localhost:3000';

  const html = wrapHtml(`
    <div class="hdr" style="background:linear-gradient(135deg,#059669,#10b981)">
      <h1>🔑 Vos identifiants SoliDev</h1>
      <p>SoliDev – Plateforme Panafricaine des Associations</p>
    </div>
    <div class="body">
      <p>Bonjour <strong>${nom || ''}</strong>,</p>
      <p>Votre paiement a bien été confirmé — votre compte est maintenant <strong style="color:#059669">actif</strong>.
         Voici vos identifiants de connexion :</p>
      <div class="highlight">
        Identifiant : <strong style="font-family:monospace">${username}</strong><br>
        Mot de passe : <strong style="font-family:monospace">${password}</strong>
      </div>
      <p style="color:#7c2d12;background:#fff7ed;border-radius:8px;padding:10px 14px;font-size:13px">
        ⚠️ Ce mot de passe ne sera communiqué qu'une seule fois. Conservez-le en lieu sûr et changez-le dès votre première connexion.
      </p>
      <a href="${loginUrl}" class="btn">Se connecter à SoliDev →</a>
    </div>
    <div class="ftr">SoliDev · Solidarité &amp; Développement · noreply@solidev.africa</div>
  `);

  const text = `Bonjour ${nom || ''},\n\nVotre paiement est confirmé, votre compte est actif.\n`
    + `Identifiant : ${username}\nMot de passe : ${password}\n\nConnexion : ${loginUrl}`;

  return {
    to: email,
    from: FROM,
    subject: `🔑 Vos identifiants de connexion — SoliDev`,
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

module.exports = { sendMail, emailAcceptee, emailRefusee, emailNouvelleDemande, emailAccepteeDoitPayer, emailIdentifiants };
