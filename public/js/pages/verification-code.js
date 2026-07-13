router.register('verification', () => {
  if (!document.getElementById('app')) document.body.innerHTML = '<div id="app"></div>';
  document.body.className = '';

  function shell(content) {
    document.body.innerHTML = `
      <div class="pub-form-wrap">
        <button class="pub-form-back" onclick="landingNav('landing')">← Retour à l'accueil</button>
        <div class="pub-form-card" style="max-width:440px">
          <div class="pub-form-logo">
            <div class="pub-form-brand">
              <img src="/images/logo.svg" class="logo-sm" alt="SoliDev">
              <span>SoliDev</span>
            </div>
          </div>
          ${content}
        </div>
      </div>`;
  }

  function renderCodeForm(errorMsg = '') {
    shell(`
      <h2 style="text-align:center;margin-bottom:4px">📱 Vérification du code</h2>
      <p style="text-align:center;color:#64748b;font-size:13px;margin-bottom:20px">
        Entrez le code reçu par SMS ou WhatsApp après l'acceptation de votre demande d'adhésion.
      </p>
      <div class="form-group">
        <label>Code de confirmation (6 chiffres)</label>
        <input type="text" id="codeInput" inputmode="numeric" maxlength="6" placeholder="••••••"
               style="letter-spacing:6px;font-size:20px;text-align:center;font-weight:700">
      </div>
      ${errorMsg ? `<p style="color:#dc2626;font-size:13px;text-align:center;margin-bottom:10px">${errorMsg}</p>` : ''}
      <button type="button" class="btn btn-primary" id="verifyCodeBtn" style="width:100%">Vérifier →</button>
    `);

    const input = document.getElementById('codeInput');
    input.focus();
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submitCode(); });
    document.getElementById('verifyCodeBtn').addEventListener('click', submitCode);
  }

  async function submitCode() {
    const code = document.getElementById('codeInput').value.trim();
    if (!code) return;
    const btn = document.getElementById('verifyCodeBtn');
    btn.disabled = true;
    btn.textContent = 'Vérification…';
    try {
      const res = await fetch('/api/public/verifier-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const pay = await res.json();
      if (!res.ok) throw new Error(pay.message || 'Code invalide');
      renderPayment(pay, code);
    } catch (err) {
      renderCodeForm(err.message);
    }
  }

  function renderPayment(pay, code) {
    shell(`
      <h2 style="text-align:center;margin-bottom:4px">💳 Paiement de cotisation</h2>
      <p style="text-align:center;color:#64748b;font-size:13px;margin-bottom:20px">${pay.Nom || ''} — ${pay.ObjetPaiement || 'Adhésion SoliDev'}</p>
      <div id="paymentWidgetContainer"></div>
    `);

    renderPaymentWidget(document.getElementById('paymentWidgetContainer'), {
      codePays: pay.CodePays,
      montant: pay.MontantPaiement,
      idPaiement: pay.IdPaiement,
      authenticated: false,
      code,
      onSuccess: () => {
        document.querySelector('.pub-form-card').insertAdjacentHTML('beforeend',
          `<p style="margin-top:16px;text-align:center;color:#059669">📧 Vos identifiants de connexion viennent de vous être envoyés par email.</p>`);
      },
    });
  }

  renderCodeForm();
});
