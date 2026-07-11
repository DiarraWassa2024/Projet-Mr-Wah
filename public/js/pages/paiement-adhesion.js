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
            <div class="logo-sm" style="background:linear-gradient(135deg,#1e40af,#4f46e5)">💳</div>
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
