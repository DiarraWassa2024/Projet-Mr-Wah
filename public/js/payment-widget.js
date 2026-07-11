/**
 * Widget de paiement mobile money réutilisable.
 * Utilisé dans le dashboard admin (paiements.js, authentifié) et sur la page
 * publique de paiement d'adhésion (paiement-adhesion.js, non authentifié).
 *
 * @param {HTMLElement} container
 * @param {object} opts
 *   codePays      {string}   — CodePays ISO (CIV, MLI, BEN, BFA, NGA, MDG)
 *   montant       {number}
 *   idPaiement    {number}
 *   authenticated {boolean}  — true = passe par api.js (JWT admin), false = endpoints publics
 *   email         {string}   — requis en mode public (vérifie que l'appelant connaît l'email du dossier)
 *   onSuccess     {function}
 */
async function renderPaymentWidget(container, { codePays, montant, idPaiement, authenticated = true, email = '', onSuccess } = {}) {
  if (!container) return;

  const opsUrl = authenticated ? `/paiements/operateurs/${codePays}` : `/public/paiement-operateurs/${codePays}`;
  const payUrl = authenticated ? `/paiements/${idPaiement}/payer`     : `/public/paiement/${idPaiement}/payer`;

  async function apiGet(path) {
    if (authenticated) return api.get(path);
    const res = await fetch('/api' + path);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`);
    return data;
  }
  async function apiPost(path, body) {
    if (authenticated) return api.post(path, body);
    const res = await fetch('/api' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`);
    return data;
  }

  container.innerHTML = `<div class="pw-loading">Chargement des opérateurs disponibles…</div>`;

  let cfg;
  try {
    cfg = await apiGet(opsUrl);
  } catch (err) {
    container.innerHTML = `<div class="pw-error">⚠️ ${err.message}</div>`;
    return;
  }

  let selected = cfg.operateurs[0]?.code || '';

  function render() {
    container.innerHTML = `
      <div class="pw-widget">
        <div class="pw-amount">${Number(montant).toLocaleString('fr-FR')} <span>${cfg.devise}</span></div>
        <div class="pw-operators">
          ${cfg.operateurs.map(o => `
            <button type="button" class="pw-op-btn${o.code === selected ? ' pw-op-active' : ''}" data-code="${o.code}">
              <span class="pw-op-icon">${o.icon}</span><span>${o.label}</span>
            </button>`).join('')}
        </div>
        <div class="pw-form-group">
          <label>Numéro de téléphone mobile money</label>
          <input type="tel" id="pwTel" placeholder="Ex : 07 00 00 00 00" required>
        </div>
        <button type="button" class="btn btn-primary pw-pay-btn" id="pwPayBtn" style="width:100%">
          💳 Payer maintenant
        </button>
        <p class="pw-note">Paiement simulé à des fins de démonstration — aucune transaction réelle n'est effectuée.</p>
      </div>`;

    container.querySelectorAll('.pw-op-btn').forEach(btn => {
      btn.addEventListener('click', () => { selected = btn.dataset.code; render(); });
    });

    container.querySelector('#pwPayBtn').addEventListener('click', async () => {
      const tel = container.querySelector('#pwTel').value.trim();
      if (!tel) { container.querySelector('#pwTel').focus(); return; }

      const btn = container.querySelector('#pwPayBtn');
      btn.disabled = true;
      btn.textContent = '⏳ Paiement en cours…';
      try {
        const body = { operateur: selected, telephone: tel };
        if (!authenticated) body.email = email;
        const result = await apiPost(payUrl, body);
        container.innerHTML = `
          <div class="pw-success">
            ✅ <strong>Paiement confirmé</strong><br>
            Référence : <code>${result.transactionRef}</code>
          </div>`;
        onSuccess?.(result);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = '💳 Payer maintenant';
        container.insertAdjacentHTML('beforeend', `<div class="pw-error">⚠️ ${err.message}</div>`);
      }
    });
  }

  render();
}
