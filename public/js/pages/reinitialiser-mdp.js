router.register('reinitialiser-mdp', async (params = {}) => {
  if (!document.getElementById('app')) document.body.innerHTML = '<div id="app"></div>';
  document.body.className = '';

  const token = params.token || '';

  function shell(content) {
    document.body.innerHTML = `
      <div class="pub-form-wrap">
        <button class="pub-form-back" onclick="landingNav('landing')">← Retour à l'accueil</button>
        <div class="pub-form-card" style="max-width:440px">
          <div class="pub-form-logo">
            <img src="/images/logo.svg" class="logo-sm" alt="SoliDev">
            <span>SoliDev</span>
          </div>
          <h2 style="text-align:center;margin-bottom:4px">🔑 Réinitialiser le mot de passe</h2>
          ${content}
        </div>
      </div>`;
  }

  if (!token) {
    shell(`<p style="text-align:center;color:#dc2626">Lien invalide — aucun token fourni.</p>`);
    return;
  }

  shell(`
    <div class="form-group" style="margin-top:16px">
      <label>Nouveau mot de passe</label>
      <input type="password" id="nouveauMdp" placeholder="Au moins 6 caractères" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px">
    </div>
    <div class="form-group">
      <label>Confirmer le mot de passe</label>
      <input type="password" id="confirmMdp" placeholder="Retapez le mot de passe" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px">
    </div>
    <div id="resetMsg" class="msg" style="display:none;margin-top:10px"></div>
    <button class="btn btn-primary btn-block" id="btnReset" style="margin-top:14px">Réinitialiser</button>
  `);

  document.getElementById('btnReset').onclick = async () => {
    const p1 = document.getElementById('nouveauMdp').value;
    const p2 = document.getElementById('confirmMdp').value;
    const msg = document.getElementById('resetMsg');
    const show = (cls, text) => { msg.style.display = 'block'; msg.className = `msg ${cls}`; msg.textContent = text; };

    if (p1.length < 6) return show('error', 'Le mot de passe doit contenir au moins 6 caractères');
    if (p1 !== p2) return show('error', 'Les deux mots de passe ne correspondent pas');

    const btn = document.getElementById('btnReset');
    btn.disabled = true; btn.textContent = 'En cours…';
    try {
      const res = await fetch('/api/auth/reinitialiser', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nouveauMotDePasse: p1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur');
      show('ok', data.message);
      btn.textContent = '✓ Terminé';
      setTimeout(() => landingNav('login'), 2000);
    } catch (e) {
      show('error', e.message);
      btn.disabled = false; btn.textContent = 'Réinitialiser';
    }
  };
});
