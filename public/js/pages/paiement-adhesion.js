router.register('paiement-adhesion', async (params = {}) => {
  if (!document.getElementById('app')) document.body.innerHTML = '<div id="app"></div>';
  document.body.className = '';

  const idPaiement = params.idPaiement || new URLSearchParams(location.search).get('paiement');

  function shell(content) {
    document.body.innerHTML = `
      <div class="pub-form-wrap">
        <button class="pub-form-back" onclick="landingNav('landing')">← Retour à l'accueil</button>
        <div class="pub-form-card" style="max-width:480px">
          <div class="pub-form-logo">
            <img src="/images/logo.svg" class="logo-sm" alt="SoliDev">
            <span>SoliDev</span>
          </div>
          ${content}
        </div>
      </div>`;
  }

  if (!idPaiement) {
    shell(`<p>Lien de paiement invalide.</p>`);
    return;
  }

  shell(`<p>Chargement…</p>`);

  let pay;
  try {
    const res = await fetch(`/api/public/paiement/${idPaiement}`);
    pay = await res.json();
    if (!res.ok) throw new Error(pay.message || 'Paiement introuvable');
  } catch (err) {
    shell(`<p>⚠️ ${err.message}</p>`);
    return;
  }

  if (pay.Statut === 'Payé') {
    shell(`
      <h2 style="text-align:center">✅ Paiement déjà confirmé</h2>
      <p style="text-align:center;color:#64748b">Vos identifiants vous ont déjà été envoyés par email.</p>`);
    return;
  }

  shell(`
    <h2 style="text-align:center;margin-bottom:4px">💳 Paiement de cotisation</h2>
    <p style="text-align:center;color:#64748b;font-size:13px;margin-bottom:20px">${pay.Nom || ''} — ${pay.ObjetPaiement || 'Adhésion SoliDev'}</p>
    <div class="form-group">
      <label>Confirmez votre email (dossier de demande)</label>
      <input type="email" id="payEmailConfirm" required placeholder="email@exemple.com">
    </div>
    <p style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 14px;font-size:12.5px;color:#7c2d12;margin:14px 0">
      ⚠️ <strong>Important :</strong> si un document justificatif fourni (agrément ministériel, pièce d'identité...)
      s'avère non authentique après vérification, votre dossier sera rejeté définitivement et
      <strong>aucun remboursement ne sera effectué</strong>, quel que soit le montant déjà réglé.
      Si votre dossier est refusé pour un tout autre motif (document valide), <strong>80% du montant
      vous sera remboursé</strong> automatiquement.
    </p>
    <div id="paymentWidgetContainer"></div>`);

  document.getElementById('payEmailConfirm').addEventListener('change', e => {
    const email = e.target.value.trim();
    if (!email) return;
    renderPaymentWidget(document.getElementById('paymentWidgetContainer'), {
      codePays: pay.CodePays,
      montant: pay.MontantPaiement,
      idPaiement: pay.IdPaiement,
      authenticated: false,
      email,
      onSuccess: () => {
        document.querySelector('.pub-form-card').insertAdjacentHTML('beforeend',
          `<p style="margin-top:16px;text-align:center;color:#059669">📧 Vos identifiants de connexion viennent de vous être envoyés par email.</p>`);
      },
    });
  });
});
